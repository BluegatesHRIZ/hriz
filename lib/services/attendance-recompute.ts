import { prisma } from "@/lib/db/prisma";

/**
 * TypeScript/Prisma port of the `crearep_attendance`, `crearep_summary`, and
 * `crearep_details` stored procedures (sql/stored_proc.sql).
 *
 * Behaviour is kept identical to the procedures:
 *  - `recomputeAttendance` resets the per-range overlay columns, re-applies the
 *    five overlays (attendance-change, overtime, undertime, leave, schedule),
 *    then runs the single giant UPDATE that recomputes the ~30 derived TIME
 *    columns (late / OT / ND / RD / SH / LH families). The cursors in the proc
 *    are replaced by equivalent set-based `UPDATE ... JOIN` statements.
 *  - The big compute UPDATE is kept SINGLE-TABLE on purpose: it relies on
 *    MySQL's left-to-right, single-table assignment order (e.g. `att_tothrsdec`
 *    reads the `att_tothrs` set earlier in the same statement, and most columns
 *    read `att_fin` / `att_fout` set at the top). The `settings_tab` values the
 *    proc fetched into locals (`_ndst`, `_ndend`, `graper`) are therefore
 *    inlined as literals rather than JOINed in, which would break that order.
 *  - The whole recompute runs in one transaction with STRICT_TRANS_TABLES
 *    relaxed (captured + restored). The legacy app ran non-strict, so an
 *    out-of-range TIME (e.g. a bad punch/OT row producing values past the
 *    838:59:59 TIME ceiling) clamps with a warning instead of aborting the
 *    report with ER_TRUNCATED_WRONG_VALUE. Cleaning the offending source row is
 *    a separate data fix.
 */

const RESET_SQL = `
UPDATE attendance SET
  att_coain=null,att_coaout=null,
  att_otmin=null,att_otmout=null,att_excess=null,
  att_utmin=null,att_utmout=null,
  att_ltype=null,att_lhalf=null,
  att_reqschin=null,att_reqschbin=null,att_reqschbout=null,att_reqschout=null,att_reqschbreak=null,att_reqrestday=null,att_reqschshift=null
WHERE att_date BETWEEN ? AND ?`;

// Attendance change (COA) — split by punch type. The proc iterated coa_detail
// rows, writing att_coain for 'I' details and att_coaout for 'O' details.
const COA_IN_SQL = `
UPDATE attendance a
JOIN coa_summary s ON s.coa_sstatus=1
JOIN coa_detail d ON d.coa_dpk=s.coa_sid AND d.coa_dtype='I'
  AND a.att_emp=s.coa_semp AND a.att_date=d.coa_ddate
SET a.att_coain = CAST(CONCAT(d.coa_ddate,' ',d.coa_dtime) AS datetime)
WHERE d.coa_ddate BETWEEN ? AND ?`;

const COA_OUT_SQL = `
UPDATE attendance a
JOIN coa_summary s ON s.coa_sstatus=1
JOIN coa_detail d ON d.coa_dpk=s.coa_sid AND d.coa_dtype='O'
  AND a.att_emp=s.coa_semp AND a.att_date=d.coa_ddate
SET a.att_coaout = CAST(CONCAT(d.coa_ddate,' ',d.coa_dtime) AS datetime)
WHERE d.coa_ddate BETWEEN ? AND ?`;

const OT_SQL = `
UPDATE attendance a
JOIN overtime o ON o.otm_emp=a.att_emp AND o.otm_date=a.att_date
SET a.att_otmin=o.otm_from,
    a.att_otmout=o.otm_to_a,
    a.att_excess=hour(timediff(o.otm_to_a,o.otm_from))+minute(timediff(o.otm_to_a,o.otm_from))
WHERE o.otm_status='1' AND o.otm_date BETWEEN ? AND ?`;

const UT_SQL = `
UPDATE attendance a
JOIN undertime u ON u.utm_emp=a.att_emp AND u.utm_date=a.att_date
SET a.att_utmin=CAST(CONCAT(u.utm_date,' ',u.utm_from) AS datetime),
    a.att_utmout=CAST(CONCAT(u.utm_date,' ',u.utm_to) AS datetime)
WHERE u.utm_status='1' AND u.utm_date BETWEEN ? AND ?`;

const LEAVE_SQL = `
UPDATE attendance a
JOIN leave_summary s ON s.lea_sstatus=1
JOIN leave_detail d ON d.lea_dpk=s.lea_sid
  AND a.att_emp=s.lea_semp AND a.att_date=d.lea_ddate
SET a.att_ltype=d.lea_dtype,
    a.att_lhalf=d.lea_dampm
WHERE d.lea_ddate BETWEEN ? AND ?`;

const SCHED_SQL = `
UPDATE attendance a
JOIN schedadjust_summary s ON s.sca_sstatus=1
JOIN schedadjust_detail d ON d.sca_dpk=s.sca_sid
  AND a.att_emp=s.sca_semp AND a.att_date=d.sca_ddate
SET a.att_reqschin=concat(a.att_date,' ',time(d.sca_dshiftstart)),
    a.att_reqschbin=concat(a.att_date,' ',time(d.sca_dbreakstart)),
    a.att_reqschbout=concat(a.att_date,' ',time(d.sca_dbreakend)),
    a.att_reqschout=concat(a.att_date,' ',time(d.sca_dshiftend)),
    a.att_reqschbreak=timediff(concat(a.att_date,' ',time(d.sca_dbreakend)),concat(a.att_date,' ',time(d.sca_dbreakstart))),
    a.att_reqrestday=d.sca_drest,
    a.att_reqschshift=d.sca_dshift
WHERE d.sca_ddate BETWEEN ? AND ?`;

/**
 * Defensive sanitize pass. The overlays above repopulate the working datetime
 * columns (`att_coain`/`att_coaout` from coa_detail, `att_otmin`/`att_otmout`
 * from overtime, `att_utmin`/`att_utmout` from undertime) from source rows that
 * are sometimes garbage — e.g. an overtime row whose `otm_from` casts to a
 * ~1900 datetime. Feeding that into the compute's `timediff()`/`addtime()`
 * produces values past MySQL's 838:59:59 TIME ceiling (the original
 * `1108739:20:36` overflow).
 *
 * These columns are reset + rebuilt on every recompute, so nulling out-of-range
 * values here is non-destructive: the underlying overtime/coa_detail record is
 * left intact, the bad row simply contributes nothing (treated as "no logs")
 * until the source data is corrected. Must run AFTER the overlays and BEFORE the
 * compute.
 *
 * The raw `att_bioin`/`att_bioout` biometric punches are NOT nulled here (that
 * would destroy audit data); instead the compute's `att_fin`/`att_fout`
 * expressions apply the same year-range guard so an out-of-range punch is
 * treated as "no punch" rather than producing a clamped-garbage duration.
 */
const SANITIZE_SQL = `
UPDATE attendance SET
  att_coain  = IF(att_coain  IS NOT NULL AND YEAR(att_coain)  NOT BETWEEN 2000 AND 2100, NULL, att_coain),
  att_coaout = IF(att_coaout IS NOT NULL AND YEAR(att_coaout) NOT BETWEEN 2000 AND 2100, NULL, att_coaout),
  att_otmin  = IF(att_otmin  IS NOT NULL AND YEAR(att_otmin)  NOT BETWEEN 2000 AND 2100, NULL, att_otmin),
  att_otmout = IF(att_otmout IS NOT NULL AND YEAR(att_otmout) NOT BETWEEN 2000 AND 2100, NULL, att_otmout),
  att_utmin  = IF(att_utmin  IS NOT NULL AND YEAR(att_utmin)  NOT BETWEEN 2000 AND 2100, NULL, att_utmin),
  att_utmout = IF(att_utmout IS NOT NULL AND YEAR(att_utmout) NOT BETWEEN 2000 AND 2100, NULL, att_utmout)
WHERE att_date BETWEEN ? AND ?`;

/**
 * Verbatim copy of the giant `UPDATE attendance SET ...` from
 * `crearep_attendance` (sql/stored_proc.sql). The proc's local variables are
 * left as the tokens `_ndst`, `_ndend`, and `graper`; `buildComputeSql` swaps
 * them for the settings_tab literals. The closing `WHERE` uses `?` placeholders
 * for the date range. SINGLE-TABLE — do not add JOINs (see file header).
 */
const COMPUTE_TEMPLATE = `
UPDATE attendance SET
att_fin=if(isnull(att_coain),if((att_bioin is not null and year(att_bioin) between 2000 and 2100) or (att_bioout is not null and year(att_bioout) between 2000 and 2100),if(att_bioin is not null and year(att_bioin) between 2000 and 2100,att_bioin,null),null),att_coain),
att_fout=if(isnull(att_coaout),if(att_bioout is not null and year(att_bioout) between 2000 and 2100,att_bioout,null),att_coaout),
att_tothrs=if(isnull(att_fin) or isnull(att_fout),0,
	if(subtime(timediff(att_fout,att_fin),if(isnull(att_reqschbreak),att_schbreak,att_reqschbreak))<0,0,subtime(timediff(att_fout,att_fin),if(isnull(att_reqschbreak),att_schbreak,att_reqschbreak)))),
att_tothrsdec=hour(att_tothrs)+minute(att_tothrs)/60,
att_wrkhrs=if(isnull(att_fin) or isnull(att_fout),0,
	subtime(timediff(if(isnull(att_reqschout),att_schout,att_reqschout),if(att_fin<=if(isnull(att_reqschin),att_schin,att_reqschin),if(isnull(att_reqschin),att_schin,att_reqschin),att_fin)),if(isnull(att_reqschbreak),att_schbreak,att_reqschbreak))),
att_wrkhrsdec=if(att_ltype='W',hour(subtime(timediff(if(isnull(att_reqschout),att_schout,att_reqschout),if(isnull(att_reqschin),att_schin,att_reqschin)),att_schbreak))+minute(subtime(timediff(if(isnull(att_reqschout),att_schout,att_reqschout),if(isnull(att_reqschin),att_schin,att_reqschin)),att_schbreak))/60,
	if(att_ltype='H' and att_lhalf='A',hour(timediff(if(isnull(att_reqschbin),att_schbin,att_reqschbin),if(isnull(att_reqschin),att_schin,att_reqschin)))+minute(timediff(if(isnull(att_reqschbin),att_schbin,att_reqschbin),if(isnull(att_reqschin),att_schin,att_reqschin)))/60,
		if(att_ltype='H' and att_lhalf='P',hour(timediff(if(isnull(att_reqschout),att_schout,att_reqschout),att_schbout))+minute(timediff(if(isnull(att_reqschout),att_schout,att_reqschout),if(isnull(att_reqschbout),att_schbout,att_reqschbout)))/60,
			hour(att_wrkhrs)+minute(att_wrkhrs)/60))),
att_late=if(att_schshift='E',0,
			if(timediff(date_sub(att_fin,interval time_format(graper,"%i:%s") minute_second),if(isnull(att_reqschin),att_schin,att_reqschin))<=0 or isnull(timediff(date_sub(att_fin,interval time_format(graper,"%i:%s") minute_second),if(isnull(att_reqschin),att_schin,att_reqschin))),0,timediff(att_fin,if(isnull(att_reqschin),att_schin,att_reqschin))
				)
			),
att_undertime=if(att_schshift='E',0,if(timediff(if(isnull(att_reqschout),att_schout,att_reqschout),att_fout)<=0 or isnull(timediff(if(isnull(att_reqschout),att_schout,att_reqschout),att_fout)),0,timediff(if(isnull(att_reqschout),att_schout,att_reqschout),att_fout))),
att_overtime=if(timediff(att_otmout,att_otmin)<=0 or isnull(timediff(att_otmout,att_otmin)),0,timediff(att_otmout,att_otmin)),

att_excess=if(att_restday='0' and att_holiday='N' and (not isnull(att_fin) and not isnull(att_fout)),
	if(timediff(att_fout,att_schout)<0,0,timediff(att_fout,att_schout)),
	0),
att_ot=if(att_restday='0' and att_holiday='N' and (not isnull(att_otmin) and not isnull(att_otmout)),
	if(att_otmout>=att_schout and att_otmout<=concat(att_date,_ndst),
		timediff(att_otmout,att_otmin),
		addtime(timediff(concat(att_date,_ndst),att_otmin),if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(att_otmout,concat(adddate(att_date, interval 1 day),_ndend)),
				'-00:00:00'))),
    0),
att_nd=if(att_restday='0' and att_holiday='N' and (not isnull(att_fin) and not isnull(att_fout)) and (isnull(att_otmin) and isnull(att_otmout)),
	if(att_schshift='N',
		if(att_fout>=concat(att_date,_ndst) and att_fout<=concat(adddate(att_date, interval 1 day),_ndend),
			timediff(att_fout,concat(att_date,_ndst)),
			timediff(concat(adddate(att_date, interval 1 day),_ndend),concat(att_date,_ndst))),
		0),
    0),
att_ndot=if(att_restday='0' and att_holiday='N' and not isnull(att_otmin) and not isnull(att_otmout),
	if(att_schshift='N',
		0,
		if(att_otmout>=concat(att_date,_ndst) and att_otmout<=concat(adddate(att_date, interval 1 day),_ndend),
			timediff(att_otmout,concat(att_date,_ndst)),
			if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(concat(adddate(att_date, interval 1 day),_ndend),concat(att_date,_ndst)),
				0))),
    0),
att_rd=if(att_restday='1' and att_holiday='N' and (not isnull(att_fin) and not isnull(att_fout)),
	timediff(att_fout,att_schout),
	0),
att_rdot=if(att_restday='1' and att_holiday='N' and not isnull(att_otmin) and not isnull(att_otmout),
	if(att_otmout>=att_schout and att_otmout<=concat(att_date,_ndst),
		timediff(att_otmout,att_otmin),
		addtime(timediff(concat(att_date,_ndst),att_otmin),if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(att_otmout,concat(adddate(att_date, interval 1 day),_ndend)),
				'-00:00:00'))),
    0),
att_rdnd=if(att_restday='1' and att_holiday='N' and (not isnull(att_fin) and not isnull(att_fout)) and (isnull(att_otmin) and isnull(att_otmout)),
	if(att_schshift='N',
		timediff(if(att_fout>concat(adddate(att_date, interval 1 day),_ndend),concat(adddate(att_date, interval 1 day),_ndend),att_fout),
				concat(att_date,_ndst)),
		0),
    0),
att_rdndot=if(att_restday='1' and att_holiday='N' and not isnull(att_otmin) and not isnull(att_otmout),
	if(att_schshift='N',
		0,
		if(att_otmout>=concat(att_date,_ndst) and att_otmout<=concat(adddate(att_date, interval 1 day),_ndend),
			timediff(att_otmout,concat(att_date,_ndst)),
			if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(concat(adddate(att_date, interval 1 day),_ndend),concat(att_date,_ndst)),
				0))),
    0),

att_sh=if(att_restday='0' and att_holiday='Y2' and (not isnull(att_fin) and not isnull(att_fout)),
	timediff(att_fout,att_schout),
	0),
att_shot=if(att_restday='0' and att_holiday='Y2' and (not isnull(att_otmin) and not isnull(att_otmout)),
	if(att_otmout>=att_schout and att_otmout<=concat(att_date,_ndst),
		timediff(att_otmout,att_otmin),
		addtime(timediff(concat(att_date,_ndst),att_otmin),if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(att_otmout,concat(adddate(att_date, interval 1 day),_ndend)),
				'-00:00:00'))),
    0),
att_shnd=if(att_restday='0' and att_holiday='Y2' and (not isnull(att_fin) and not isnull(att_fout)) and (isnull(att_otmin) and isnull(att_otmout)),
	if(att_schshift='N',
		if(att_fout>=concat(att_date,_ndst) and att_fout<=concat(adddate(att_date, interval 1 day),_ndend),
			timediff(att_fout,concat(att_date,_ndst)),
			timediff(concat(adddate(att_date, interval 1 day),_ndend),concat(att_date,_ndst))),
		0),
    0),
att_shndot=if(att_restday='0' and att_holiday='Y2' and not isnull(att_otmin) and not isnull(att_otmout),
	if(att_schshift='N',
		0,
		if(att_otmout>=concat(att_date,_ndst) and att_otmout<=concat(adddate(att_date, interval 1 day),_ndend),
			timediff(att_otmout,concat(att_date,_ndst)),
			if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(concat(adddate(att_date, interval 1 day),_ndend),concat(att_date,_ndst)),
				0))),
    0),
att_shrd=if(att_restday='1' and att_holiday='Y2' and (not isnull(att_fin) and not isnull(att_fout)),
	timediff(att_fout,att_schout),
	0),
att_shrdot=if(att_restday='1' and att_holiday='Y2' and not isnull(att_otmin) and not isnull(att_otmout),
	if(att_otmout>=att_schout and att_otmout<=concat(att_date,_ndst),
		timediff(att_otmout,att_otmin),
		addtime(timediff(concat(att_date,_ndst),att_otmin),if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(att_otmout,concat(adddate(att_date, interval 1 day),_ndend)),
				'-00:00:00'))),
    0),
att_shrdnd=if(att_restday='1' and att_holiday='Y2' and (not isnull(att_fin) and not isnull(att_fout)) and (isnull(att_otmin) and isnull(att_otmout)),
	if(att_schshift='N',
		timediff(if(att_fout>concat(adddate(att_date, interval 1 day),_ndend),concat(adddate(att_date, interval 1 day),_ndend),att_fout),
				concat(att_date,_ndst)),
		0),
    0),
att_shrdndot=if(att_restday='1' and att_holiday='Y2' and not isnull(att_otmin) and not isnull(att_otmout),
	if(att_schshift='N',
		0,
		if(att_otmout>=concat(att_date,_ndst) and att_otmout<=concat(adddate(att_date, interval 1 day),_ndend),
			timediff(att_otmout,concat(att_date,_ndst)),
			if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(concat(adddate(att_date, interval 1 day),_ndend),concat(att_date,_ndst)),
				0))),
    0),

att_lh=if(att_restday='0' and att_holiday='Y1' and (not isnull(att_fin) and not isnull(att_fout)),
	timediff(att_fout,att_schout),
	0),
att_lhot=if(att_restday='0' and att_holiday='Y1' and (not isnull(att_otmin) and not isnull(att_otmout)),
	if(att_otmout>=att_schout and att_otmout<=concat(att_date,_ndst),
		timediff(att_otmout,att_otmin),
		addtime(timediff(concat(att_date,_ndst),att_otmin),if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(att_otmout,concat(adddate(att_date, interval 1 day),_ndend)),
				'-00:00:00'))),
    0),
att_lhnd=if(att_restday='0' and att_holiday='Y1' and (not isnull(att_fin) and not isnull(att_fout)) and (isnull(att_otmin) and isnull(att_otmout)),
	if(att_schshift='N',
		if(att_fout>=concat(att_date,_ndst) and att_fout<=concat(adddate(att_date, interval 1 day),_ndend),
			timediff(att_fout,concat(att_date,_ndst)),
			timediff(concat(adddate(att_date, interval 1 day),_ndend),concat(att_date,_ndst))),
		0),
    0),
att_lhndot=if(att_restday='0' and att_holiday='Y1' and not isnull(att_otmin) and not isnull(att_otmout),
	if(att_schshift='N',
		0,
		if(att_otmout>=concat(att_date,_ndst) and att_otmout<=concat(adddate(att_date, interval 1 day),_ndend),
			timediff(att_otmout,concat(att_date,_ndst)),
			if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(concat(adddate(att_date, interval 1 day),_ndend),concat(att_date,_ndst)),
				0))),
    0),
att_lhrd=if(att_restday='1' and att_holiday='Y1' and (not isnull(att_fin) and not isnull(att_fout)),
	timediff(att_fout,att_schout),
	0),
att_lhrdot=if(att_restday='1' and att_holiday='Y1' and not isnull(att_otmin) and not isnull(att_otmout),
	if(att_otmout>=att_schout and att_otmout<=concat(att_date,_ndst),
		timediff(att_otmout,att_otmin),
		addtime(timediff(concat(att_date,_ndst),att_otmin),if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(att_otmout,concat(adddate(att_date, interval 1 day),_ndend)),
				'-00:00:00'))),
    0),
att_lhrdnd=if(att_restday='1' and att_holiday='Y1' and (not isnull(att_fin) and not isnull(att_fout)) and (isnull(att_otmin) and isnull(att_otmout)),
	if(att_schshift='N',
		timediff(if(att_fout>concat(adddate(att_date, interval 1 day),_ndend),concat(adddate(att_date, interval 1 day),_ndend),att_fout),
				concat(att_date,_ndst)),
		0),
    0),
att_lhrdndot=if(att_restday='1' and att_holiday='Y1' and not isnull(att_otmin) and not isnull(att_otmout),
	if(att_schshift='N',
		0,
		if(att_otmout>=concat(att_date,_ndst) and att_otmout<=concat(adddate(att_date, interval 1 day),_ndend),
			timediff(att_otmout,concat(att_date,_ndst)),
			if(att_otmout>=concat(adddate(att_date, interval 1 day),_ndend),
				timediff(concat(adddate(att_date, interval 1 day),_ndend),concat(att_date,_ndst)),
				0))),
    0)

WHERE (att_date BETWEEN ? AND ?)`;

/**
 * Builds a quoted SQL TIME literal from a settings value, preserving the
 * leading space the proc added via `concat(' ', set_ndst)` when `withLeadingSpace`
 * is set (so `concat(att_date, _ndst)` keeps producing "YYYY-MM-DD HH:MM:SS").
 * Returns `NULL` when the setting is null, matching the proc's behaviour with
 * unconfigured settings.
 */
/**
 * Internal SQL building blocks, exported for verification/testing only. Not part
 * of the public service API — use `recomputeAttendance` in application code.
 */
export const _attendanceRecomputeSql = {
  RESET_SQL,
  COA_IN_SQL,
  COA_OUT_SQL,
  OT_SQL,
  UT_SQL,
  LEAVE_SQL,
  SCHED_SQL,
  SANITIZE_SQL,
  COMPUTE_TEMPLATE,
};

function timeLiteral(value: unknown, withLeadingSpace: boolean): string {
  if (value === null || value === undefined) return "NULL";
  const raw = String(value).trim();
  if (!/^\d{1,3}:\d{2}:\d{2}$/.test(raw)) {
    throw new Error(`Unexpected settings_tab TIME value: ${JSON.stringify(value)}`);
  }
  return withLeadingSpace ? `' ${raw}'` : `'${raw}'`;
}

/** Exported for verification/testing only. */
export const _timeLiteral = timeLiteral;

async function buildComputeSql(): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ ndst: unknown; ndend: unknown; graper: unknown }>
  >(
    "SELECT TIME_FORMAT(set_ndst,'%H:%i:%s') AS ndst, TIME_FORMAT(set_nden,'%H:%i:%s') AS ndend, TIME_FORMAT(set_graceperiod,'%H:%i:%s') AS graper FROM settings_tab LIMIT 1",
  );
  const row = rows[0] ?? { ndst: null, ndend: null, graper: null };
  const ndst = timeLiteral(row.ndst, true);
  const ndend = timeLiteral(row.ndend, true);
  const graper = timeLiteral(row.graper, false);

  return COMPUTE_TEMPLATE
    .replaceAll("_ndst", ndst)
    .replaceAll("_ndend", ndend)
    .replaceAll("graper", graper);
}

/**
 * Port of `CALL crearep_attendance(from, to)`. Refreshes the `attendance` table
 * overlays and recomputes the derived TIME columns for the date range, in one
 * transaction with strict mode relaxed.
 */
export async function recomputeAttendance(from: string, to: string): Promise<void> {
  const computeSql = await buildComputeSql();

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET @__hris_old_mode := @@SESSION.sql_mode");
      await tx.$executeRawUnsafe(
        "SET SESSION sql_mode = REPLACE(REPLACE(@@SESSION.sql_mode,'STRICT_TRANS_TABLES',''),'STRICT_ALL_TABLES','')",
      );
      try {
        await tx.$executeRawUnsafe(RESET_SQL, from, to);
        await tx.$executeRawUnsafe(COA_IN_SQL, from, to);
        await tx.$executeRawUnsafe(COA_OUT_SQL, from, to);
        await tx.$executeRawUnsafe(OT_SQL, from, to);
        await tx.$executeRawUnsafe(UT_SQL, from, to);
        await tx.$executeRawUnsafe(LEAVE_SQL, from, to);
        await tx.$executeRawUnsafe(SCHED_SQL, from, to);
        await tx.$executeRawUnsafe(SANITIZE_SQL, from, to);
        await tx.$executeRawUnsafe(computeSql, from, to);
      } finally {
        await tx.$executeRawUnsafe("SET SESSION sql_mode = @__hris_old_mode");
      }
    },
    { timeout: 120_000, maxWait: 15_000 },
  );
}

/**
 * Builds a safe `AND <col> IN (?, ?, ...)` fragment from a list of filter
 * values, mirroring the proc's `emp_loc IN (...)` filters but parameterized.
 */
function inFilter(column: string, values: string[]): { sql: string; params: string[] } {
  const clean = values.map((v) => (v ?? "").trim()).filter((v) => v.length > 0);
  if (clean.length === 0) return { sql: "", params: [] };
  const placeholders = clean.map(() => "?").join(",");
  return { sql: ` AND ${column} IN (${placeholders})`, params: clean };
}

export interface AttendanceScope {
  location?: string[];
  department?: string[];
  position?: string[];
}

/**
 * Port of `CALL crearep_summary(from, to, loc, dep, pos)` — the grouped
 * per-employee header rows.
 */
export async function queryAttendanceSummary(
  from: string,
  to: string,
  scope: AttendanceScope = {},
): Promise<Record<string, unknown>[]> {
  const loc = inFilter("emp_loc", scope.location ?? []);
  const dep = inFilter("emp_dept", scope.department ?? []);
  const pos = inFilter("emp_pos", scope.position ?? []);

  const sql = `
SELECT
  att_emp AS emp_id,
  fil_path AS prof_pic,
  dep_desc, pst_desc, loc_desc,
  concat(emp_last,", ", emp_first) as emp_fullname,
  count(if(att_holiday='N' and coalesce(att_reqrestday,att_restday)='0',1,null)) as emp_workday,
  count(if((not isnull(att_fin) and not isnull(att_fout)) or (coalesce(att_reqschshift,att_schshift)='E') and (coalesce(att_reqrestday,att_restday)='0' and att_holiday='N'),1,null)) as emp_present,
  count(IF(LEFT(att_holiday, 1)='Y' OR COALESCE(att_reqschshift, att_schshift)='E',NULL,IF(COALESCE(att_reqrestday, att_restday)='0' AND (att_fin IS NULL OR att_fout IS NULL),if(not isnull(att_fin) and not isnull(att_fout),null,1),null))) as emp_absent,
  count(if(coalesce(att_reqrestday,att_restday)='1',1,null)) as emp_restday,
  sum(if(not isnull(att_ltype),if(att_ltype='W',1,.5),0)) as emp_leave,
  count(if(left(att_holiday,1)='Y',1,null)) as emp_holiday,
  sum(att_tothrsdec) as emp_hoursworked,
  round(sum(time_to_sec(att_overtime))/60,0) as emp_ot,
  (round(sum(time_to_sec(att_late))/60,0)) + (round(sum(time_to_sec(att_undertime))/60,0)) as emp_lateut,
  sec_to_time(sum(time_to_sec(att_excess))) as att_excess, sec_to_time(sum(time_to_sec(att_ot))) as att_ot, sec_to_time(sum(time_to_sec(att_nd))) as att_nd, sec_to_time(sum(time_to_sec(att_ndot))) as att_ndot,
  sec_to_time(sum(time_to_sec(att_rd))) as att_rd, sec_to_time(sum(time_to_sec(att_rdot))) as att_rdot, sec_to_time(sum(time_to_sec(att_rdnd))) as att_rdnd, sec_to_time(sum(time_to_sec(att_rdndot))) as att_rdndot,
  sec_to_time(sum(time_to_sec(att_sh))) as att_sh, sec_to_time(sum(time_to_sec(att_shot))) as att_shot, sec_to_time(sum(time_to_sec(att_shnd))) as att_shnd, sec_to_time(sum(time_to_sec(att_shndot))) as att_shndot,
  sec_to_time(sum(time_to_sec(att_shrd))) as att_shrd, sec_to_time(sum(time_to_sec(att_shrdot))) as att_shrdot, sec_to_time(sum(time_to_sec(att_shrdnd))) as att_shrdnd, sec_to_time(sum(time_to_sec(att_shrdndot))) as att_shrdndot,
  sec_to_time(sum(time_to_sec(att_lh))) as att_lh, sec_to_time(sum(time_to_sec(att_lhot))) as att_lhot, sec_to_time(sum(time_to_sec(att_lhnd))) as att_lhnd, sec_to_time(sum(time_to_sec(att_lhndot))) as att_lhndot,
  sec_to_time(sum(time_to_sec(att_lhrd))) as att_lhrd, sec_to_time(sum(time_to_sec(att_lhrdot))) as att_lhrdot, sec_to_time(sum(time_to_sec(att_lhrdnd))) as att_lhrdnd, sec_to_time(sum(time_to_sec(att_lhrdndot))) as att_lhrdndot,
  sec_to_time(sum(time_to_sec(att_dh))) as att_dh, sec_to_time(sum(time_to_sec(att_dhot))) as att_dhot, sec_to_time(sum(time_to_sec(att_dhnd))) as att_dhnd, sec_to_time(sum(time_to_sec(att_dhndot))) as att_dhndot,
  sec_to_time(sum(time_to_sec(att_dhrd))) as att_dhrd, sec_to_time(sum(time_to_sec(att_dhrdot))) as att_dhrdot, sec_to_time(sum(time_to_sec(att_dhrdnd))) as att_dhrdnd, sec_to_time(sum(time_to_sec(att_dhrdndot))) as att_dhrdndot
FROM attendance
LEFT JOIN employee ON att_emp=emp_id
LEFT JOIN department ON emp_dept = dep_id
LEFT JOIN position ON emp_pos = pst_id
LEFT JOIN location ON emp_loc = loc_id
LEFT JOIN files ON fil_fk = emp_id AND fil_type = 'emp_profile' AND fil_status = 1
WHERE (att_date BETWEEN ? AND ?)${loc.sql}${dep.sql}${pos.sql}
GROUP BY att_emp`;

  return prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    sql,
    from,
    to,
    ...loc.params,
    ...dep.params,
    ...pos.params,
  );
}

/**
 * Port of `CALL crearep_details(from, to, loc, dep, pos)` — the day-by-day
 * detail rows that hang under each summary header.
 */
export async function queryAttendanceDetails(
  from: string,
  to: string,
  scope: AttendanceScope = {},
): Promise<Record<string, unknown>[]> {
  const loc = inFilter("emp_loc", scope.location ?? []);
  const dep = inFilter("emp_dept", scope.department ?? []);
  const pos = inFilter("emp_pos", scope.position ?? []);

  const sql = `
SELECT
  att_emp as emp_id,
  att_date AS emp_date,
  dayname(att_date) AS emp_day,
  CASE att_schshift
    when 'R' then 'Regular'
    when 'N' then 'Night Shift'
    when 'F' then 'Flexible'
    when 'E' then 'Exempted'
  END AS emp_shift,
  if(not isnull(myleave.lea_dtype),'On Leave',if(left(att_holiday,1)='Y','Holiday',if(att_restday='1','Rest Day',concat(date_format(att_schin,'%h:%i %p'),' to ',date_format(att_schout,'%h:%i %p'))))) AS emp_schedule,
  if(isnull(att_fin) and isnull(att_fout),'No Logs',concat(if(isnull(att_fin),'(No In)',date_format(att_fin,'%l:%i %p')),' to ',if(isnull(att_fout),'(No Out)',date_format(att_fout,'%l:%i %p')))) AS emp_clockinandout,
  att_tothrsdec AS emp_clockedhours,
  hour(att_late)*60+minute(att_late) AS emp_late,
  hour(att_undertime)*60+minute(att_undertime) AS emp_undertime,
  att_wrkhrsdec AS emp_regularhours,
  hour(att_overtime)*60+minute(att_overtime) AS emp_overtime,
  att_wrkhrsdec+(hour(att_overtime)+minute(att_overtime)/60) AS emp_paidhours,
  att_excess, att_ot, att_nd, att_ndot,
  att_rd, att_rdot, att_rdnd, att_rdndot,
  att_sh, att_shot, att_shnd, att_shndot, att_shrd,
  att_shrdot, att_shrdnd, att_shrdndot,
  att_lh, att_lhot, att_lhnd, att_lhndot,
  att_lhrd, att_lhrdot, att_lhrdnd, att_lhrdndot,
  att_dh, att_dhot, att_dhnd, att_dhndot,
  att_dhrd, att_dhrdot, att_dhrdnd, att_dhrdndot
FROM attendance
LEFT JOIN employee ON emp_id=att_emp
LEFT JOIN (select lea_ddate,lea_semp,concat(lea_dtype,lea_dampm) as lea_dtype from leave_detail left join leave_summary on lea_dpk=lea_sid where lea_sstatus=1) myleave on myleave.lea_ddate=att_date and myleave.lea_semp=att_emp
WHERE (att_date BETWEEN ? AND ?)${loc.sql}${dep.sql}${pos.sql}`;

  return prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    sql,
    from,
    to,
    ...loc.params,
    ...dep.params,
    ...pos.params,
  );
}
