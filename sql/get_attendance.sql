SELECT * FROM (
	SELECT * FROM (
		SELECT
			main.att_emp,
			att_date as bio_date,
			hol_name,
			CONCAT(att_date,att_emp) as bio_id,
			att_emp as bio_emp,
            att_schin as sch_in,
			att_schout as sch_out,
			CASE
				WHEN coa_in IS NOT NULL
					THEN TIME_FORMAT(coa_in,"%h:%i %p")
				WHEN att_bioin IS NULL THEN NULL
				ELSE TIME_FORMAT(att_bioin,"%h:%i %p") END as mtin,
			CASE
				WHEN att_brkin IS NULL THEN NULL
				ELSE TIME_FORMAT(att_brkin,"%h:%i %p") END as brkin,
			CASE
				WHEN att_brkout IS NULL THEN NULL
				ELSE TIME_FORMAT(att_brkout,"%h:%i %p") END as brkout,
			CASE
				WHEN coa_out IS NOT NULL
					THEN TIME_FORMAT(coa_out,"%h:%i %p")
				WHEN att_bioout IS NULL THEN NULL
				ELSE TIME_FORMAT(att_bioout,"%h:%i %p") END as mtout,
			CASE WHEN att_logdate IS NULL THEN NULL ELSE att_logdate END as bio_logdate,
			1 as current_cutoff,

            CASE
				WHEN hol_name IS NOT NULL AND hol_name != ""
					THEN hol_name
				WHEN att_restday = 1
					THEN "Rest Day"
				WHEN att_schshift="E"
					THEN ""
				WHEN att_bioin IS NULL AND now() < att_schin AND att_bioout IS NULL AND @today = att_date
					THEN CONCAT("Expected in ",TIME_FORMAT(att_schin,"%h:%i %p"))
				WHEN att_date BETWEEN leas.lea_sfrom AND leas.lea_sto
					THEN CASE

						WHEN lea_dtype = "H" AND (coa_in IS NULL AND att_bioin IS NULL) AND @today > att_date
							THEN "Missing Log (No Log in)"
						WHEN lea_dtype = "H" AND (coa_in IS NULL AND coa_out IS NOT NULL AND att_bioin IS NULL) AND @today = att_date
							THEN "Missing Log (No Log in)"
						WHEN lea_dtype = "H" AND (coa_out IS NULL AND att_bioout IS NULL) AND @today > att_date
							THEN "Missing Log (No Log out)"

						WHEN att_schshift ="F" AND @flex_set = 1 AND lea_dtype = "H" AND lea_dampm = "A" AND ((att_bioin > SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2)) OR (coa_in > SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2))) AND @today >= att_date
							THEN "Late"
						WHEN att_schshift !="F" AND lea_dtype = "H" AND lea_dampm = "A" AND ((att_bioin > SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2)) OR (coa_in > SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2))) AND @today >= att_date
							THEN "Late"
						WHEN lea_dtype = "H" AND lea_dampm = "A" AND att_schshift ="R" AND (coa_out < TIME(att_schout) OR att_bioout < att_schout)
							THEN IF(att_date = unders.utm_date,"","Undertime")
						WHEN lea_dtype = "H" AND lea_dampm = "A" AND att_schshift ="F" AND @flex_set = 1 AND (TIME(att_schout) > coa_out OR att_schout > att_bioout)
							THEN IF(att_date = unders.utm_date,"","Undertime")
						WHEN lea_dtype = "H" AND lea_dampm = "A" AND att_schshift ="F" AND (HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(coa_in,coa_out))) OR HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(att_bioin,att_bioout))))
							THEN IF(att_date = unders.utm_date,"","Undertime")

						WHEN att_schshift ="F" AND @flex_set = 1 AND lea_dtype = "H" AND lea_dampm = "P" AND (att_bioin > att_schin OR coa_in > TIME(att_schin)) AND @today >= att_date
							THEN "Late"
						WHEN att_schshift !="F" AND lea_dtype = "H" AND lea_dampm = "P" AND (att_bioin > att_schin OR coa_in > TIME(att_schin)) AND @today >= att_date
							THEN "Late"
						WHEN lea_dtype = "H" AND lea_dampm = "P" AND att_schshift ="R"
                        AND (coa_out < SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2) OR TIME(att_bioout) < SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2))
							THEN IF(att_date = unders.utm_date,"","Undertime")
						WHEN lea_dtype = "H" AND lea_dampm = "P" AND att_schshift ="F" AND @flex_set = 1
                        AND (SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2) > coa_out OR (SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2) > TIME(att_bioout)))
							THEN IF(att_date = unders.utm_date,"","Undertime")
						WHEN att_schshift ="F" AND (HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(coa_in,coa_out))) OR HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(att_bioin,att_bioout))))
							THEN IF(att_date = unders.utm_date,"","Undertime")

						ELSE "On Leave"
                    END
				WHEN att_date = coas.coa_ddate
					THEN
						CASE

							WHEN (coa_in IS NULL AND att_bioin IS NULL) AND @today > att_date
								THEN "Missing Log (No Log in)"
							WHEN (coa_in IS NULL AND coa_out IS NOT NULL AND att_bioin IS NULL) AND @today = att_date
								THEN "Missing Log (No Log in)"
							WHEN (coa_out IS NULL AND att_bioout IS NULL) AND @today > att_date
								THEN "Missing Log (No Log out)"
							WHEN att_schshift ="F" AND @flex_set= 1 AND (CONCAT(att_date," ",coa_in) > att_schin OR (att_bioin > att_schin AND coa_in IS NULL)) AND @today >= att_date
								THEN "Late"
							WHEN att_schshift !="F" AND (CONCAT(att_date," ",coa_in) > att_schin OR (att_bioin > att_schin AND coa_in IS NULL)) AND @today >= att_date
								THEN "Late"
							WHEN att_schshift ="R" AND (coa_out < TIME(att_schout) OR (att_bioout < att_schout))
								 THEN IF(att_date = unders.utm_date,"","Undertime")
							WHEN att_schshift ="F" AND @flex_set=1 AND (coa_out < TIME(att_schout) OR (att_bioout < att_schout))
								THEN IF(att_date = unders.utm_date,"","Undertime")
							WHEN att_schshift ="F" AND (HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(coa_in,coa_out))) OR (HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(att_bioin,att_bioout)))))
								THEN IF(att_date = unders.utm_date,"","Undertime")
							ELSE ""
                        END
				-- WHEN att_bioin IS NULL AND att_bioout IS NULL AND @today = att_date
					-- THEN "Missing Log (No Logs)"

				WHEN att_bioin IS NULL and not isnull(att_bioout) AND @today > att_date
					THEN "Missing Log (No Log in)"
				WHEN not isnull(att_bioin) and att_bioout IS NULL AND @today > att_date
					THEN "Missing Log (No Log out)"
				-- WHEN att_bioin IS NULL AND att_bioout IS NOT NULL AND @today = att_date
				-- 	THEN "Missing Log (No Log in)"
				WHEN att_schshift ="F" AND @flex_set= 1 AND att_bioin > att_schin AND @today >= att_date
					THEN "Late"
				WHEN att_schshift != "F" AND att_bioin > att_schin AND @today >= att_date
					THEN "Late"
				WHEN att_schshift ="R" AND att_bioout < att_schout
					THEN IF(att_date = unders.utm_date,"","Undertime")
				WHEN att_schshift ="F" AND att_schout > att_bioout AND @flex_set = 1
					THEN IF(att_date = unders.utm_date,"","Undertime")
				WHEN att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))
					THEN IF(att_date = unders.utm_date,"","Undertime")
				WHEN att_bioout IS NULL AND att_schout < now() AND @today = att_date
					THEN "Need to logout"
				WHEN att_schshift ="F" AND @flex_set= 1 AND att_bioin IS NULL AND now() > att_schin AND att_bioout IS NULL AND @today = att_date
					THEN "Running Late"
				WHEN att_schshift !="F" AND att_bioin IS NULL AND now() > att_schin AND att_bioout IS NULL AND @today = att_date
					THEN "Running Late"
				WHEN @today > att_date AND att_bioin IS NULL AND att_bioout IS NULL
					THEN "Absent"
				ELSE ""
            END as msg,

            CASE
				WHEN (att_date BETWEEN leas.lea_sfrom AND leas.lea_sto)
					AND ((@today > att_date AND att_bioin IS NULL AND att_bioout IS NULL ) OR
					(att_bioout IS NULL AND @today > att_date) OR
                    (att_bioin IS NULL AND @today > att_date) OR
					(att_bioin IS NULL AND att_bioout IS NOT NULL AND @today = att_date) OR
                    (att_schshift ="R" AND att_bioout < att_schout) OR
					(att_schshift ="F" AND @flex_set =1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))))
					THEN "A"
				WHEN (att_date BETWEEN fleas.lea_sfrom AND fleas.lea_sto)
					AND ((@today > att_date AND att_bioin IS NULL AND att_bioout IS NULL ) OR
					(att_bioout IS NULL AND @today > att_date) OR
                    (att_bioin IS NULL AND @today > att_date) OR
					(att_bioin IS NULL AND att_bioout IS NOT NULL AND @today = att_date) OR
                    (att_schshift ="R" AND att_bioout < att_schout) OR
					(att_schshift ="F" AND @flex_set =1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))))
					THEN "F"
				WHEN (att_date = coas.coa_ddate)
					AND ((@today > att_date AND att_bioin IS NULL AND att_bioout IS NULL ) OR
					(att_bioout IS NULL AND @today > att_date) OR
                    (att_bioin IS NULL AND @today > att_date) OR
					(att_bioin IS NULL AND att_bioout IS NOT NULL AND @today = att_date) OR
                    (att_schshift ="R" AND att_bioout < att_schout) OR
					(att_schshift ="F" AND @flex_set =1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))) OR
                    (att_bioin > att_schin AND @today >= att_date))
					THEN "A"
				WHEN (att_date = fcoas.coa_ddate)
					AND ((@today > att_date AND att_bioin IS NULL AND att_bioout IS NULL ) OR
					(att_bioout IS NULL AND @today > att_date) OR
                    (att_bioin IS NULL AND @today > att_date) OR
					(att_bioin IS NULL AND att_bioout IS NOT NULL AND @today = att_date) OR
                    (att_schshift ="R" AND att_bioout < att_schout) OR
					(att_schshift ="F" AND @flex_set =1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))) OR
                    (att_bioin > att_schin AND @today >= att_date))
					THEN "F"
				WHEN (att_date = unders.utm_date)
					AND ((att_schshift ="R" AND att_bioout < att_bioout) OR
					(att_schshift ="F" AND @flex_set =1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))))
					THEN "A"
				WHEN (att_date = funders.utm_date)
					AND ((att_schshift ="R" AND att_bioout < att_bioout) OR
					(att_schshift ="F" AND @flex_set =1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))))
					THEN "F"
				ELSE "N"
            END as filed

		FROM
			(
				SELECT
					att_date, att_emp,
                    IF(att_reqschin IS NULL, att_schin,att_reqschin) as att_schin,
                    IF(att_reqschout IS NULL, att_schout,att_reqschout) as att_schout,
                    IF(att_reqschbin IS NULL,att_schbin,att_reqschbin) as att_schbin,
                    IF(att_reqschbout IS NULL,att_schbout,att_reqschbout) as att_schbout,
                    IF(att_reqschhrs IS NULL,att_schhrs,att_reqschhrs) as att_schhrs,
                    IF(att_reqschshift IS NULL,att_schshift,att_reqschshift) as att_schshift,
                    IF(att_reqschbreak IS NULL,att_schbreak,att_reqschbreak) as att_schbreak,
                    IF(att_reqrestday IS NULL,att_restday,att_reqrestday) as att_restday,
                    att_holiday, att_bioin, att_bioout,att_wrkhrs, att_logdate,att_brkin,att_brkout
				FROM attendance WHERE att_emp = emp_id AND MONTH(@today) = MONTH(att_date) AND YEAR(@today) = YEAR(att_date) AND (IF (@is_first_half = 1,
					att_date <= @today
				,
					DAYOFMONTH(att_date) > 15
					AND att_date <= @today
				))
            ) as main

            LEFT JOIN (
			SELECT hol_name,hol_date,hol_repeat FROM holiday WHERE hol_status = 1
        ) as holi ON main.att_date = holi.hol_date -- IF(hol_repeat= "Yearly",(MONTH(main.att_date)=MONTH(holi.hol_date) AND DAY(main.att_date)=DAY(holi.hol_date)),
			-- main.att_date = holi.hol_date)

			LEFT JOIN (
				SELECT lea_sfrom,lea_sto,ld.lea_dtype,lea_dampm,lea_ddate FROM leave_summary as ls
					LEFT JOIN leave_detail as ld ON ls.lea_sid = ld.lea_dpk
				WHERE
				 lea_semp = emp_id
					AND lea_sstatus = 1
			) as leas ON main.att_date= leas.lea_ddate

			LEFT JOIN (
				SELECT dtl.coa_ddate, MAX(coa_in) as coa_in, MAX(coa_out) as coa_out FROM (
					SELECT coa_semp,coa_ddate , MIN(coa_dtime) as coa_in,null as coa_out FROM
					coa_summary as smr
                    LEFT JOIN coa_detail ON smr.coa_sid=coa_dpk
						WHERE smr.coa_sstatus = 1 AND coa_dtype = "I"
					GROUP BY coa_ddate,coa_semp
				UNION ALL
					SELECT coa_semp,coa_ddate ,null as coa_in, MAX(coa_dtime) as coa_out FROM
					coa_summary as smr
                     LEFT JOIN coa_detail ON smr.coa_sid=coa_dpk
						WHERE smr.coa_sstatus = 1 AND coa_dtype = "O"
					GROUP BY coa_ddate,coa_semp
				) as dtl  WHERE coa_semp = emp_id
				GROUP BY coa_ddate,coa_semp
			) as coas ON main.att_date = coas.coa_ddate

			LEFT JOIN (
				SELECT utm_date,MAX(utm_logdate) FROM undertime
					WHERE utm_emp = emp_id AND utm_status = 1
			) as unders ON main.att_date = unders.utm_date

			LEFT JOIN (
				SELECT utm_date,MAX(utm_logdate) FROM undertime
					WHERE utm_emp = emp_id AND utm_status = 0
			) as funders ON main.att_date = funders.utm_date

			LEFT JOIN (
				SELECT lea_sfrom,lea_sto,lea_ddate FROM leave_summary as ls
					LEFT JOIN leave_detail as ld ON ls.lea_sid = ld.lea_dpk
				WHERE
				 lea_semp = emp_id
					AND lea_sstatus = 0
			) as fleas ON main.att_date= fleas.lea_ddate

			LEFT JOIN (
				SELECT dtl.coa_ddate FROM (
					SELECT coa_semp,coa_ddate , MIN(coa_dtime) as coa_in,null as coa_out FROM
					coa_summary as smr
                    LEFT JOIN coa_detail ON smr.coa_sid=coa_dpk
						WHERE smr.coa_sstatus = 0 AND coa_dtype = "I"
					GROUP BY coa_ddate,coa_semp
				UNION ALL
					SELECT coa_semp,coa_ddate ,null as coa_in, MAX(coa_dtime) as coa_out FROM
					coa_summary as smr
                     LEFT JOIN coa_detail ON smr.coa_sid=coa_dpk
						WHERE smr.coa_sstatus = 0 AND coa_dtype = "O"
					GROUP BY coa_ddate,coa_semp
				) as dtl  WHERE coa_semp = emp_id
				GROUP BY coa_ddate,coa_semp
			) as fcoas ON main.att_date = fcoas.coa_ddate


    ) as cur_cutoff

    UNION ALL (
    SELECT * FROM (
		SELECT
			main.att_emp,
			att_date as bio_date,
			hol_name,
			CONCAT(att_date,att_emp) as bio_id,
			att_emp as bio_emp,
            att_schin as sch_in,
			att_schout as sch_out,
			CASE
				WHEN coa_in IS NOT NULL
					THEN TIME_FORMAT(coa_in,"%h:%i %p")
				WHEN att_bioin IS NULL THEN NULL
				ELSE TIME_FORMAT(att_bioin,"%h:%i %p") END as mtin,
			CASE
				WHEN att_brkin IS NULL THEN NULL
				ELSE TIME_FORMAT(att_brkin,"%h:%i %p") END as brkin,
			CASE
				WHEN att_brkout IS NULL THEN NULL
				ELSE TIME_FORMAT(att_brkout,"%h:%i %p") END as brkout,
			CASE
				WHEN coa_out IS NOT NULL
					THEN TIME_FORMAT(coa_out,"%h:%i %p")
				WHEN att_bioout IS NULL THEN NULL
				ELSE TIME_FORMAT(att_bioout,"%h:%i %p") END as mtout,
			CASE WHEN att_logdate IS NULL THEN NULL ELSE att_logdate END as bio_logdate,
			0 as current_cutoff,

            CASE
				WHEN hol_name IS NOT NULL AND hol_name != ""
					THEN hol_name
				WHEN att_restday = 1
					THEN "Rest Day"
				WHEN att_schshift="E"
					THEN ""
				WHEN att_date BETWEEN leas.lea_sfrom AND leas.lea_sto
					THEN CASE

						WHEN lea_dtype = "H" AND (coa_in IS NULL AND att_bioin IS NULL) AND @today > att_date
							THEN "Missing Log (No Log in)"
						WHEN lea_dtype = "H" AND (coa_in IS NULL AND coa_out IS NOT NULL AND att_bioin IS NULL) AND @today = att_date
							THEN "Missing Log (No Log in)"
						WHEN lea_dtype = "H" AND (coa_out IS NULL AND att_bioout IS NULL) AND @today > att_date
							THEN "Missing Log (No Log out)"

						WHEN att_schshift ="F" AND @flex_set = 1 AND lea_dtype = "H" AND lea_dampm = "A" AND ((att_bioin > SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2)) OR (coa_in > SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2))) AND @today >= att_date
							THEN "Late"
						WHEN att_schshift !="F" AND lea_dtype = "H" AND lea_dampm = "A" AND ((att_bioin > SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2)) OR (coa_in > SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2))) AND @today >= att_date
							THEN "Late"
						WHEN lea_dtype = "H" AND lea_dampm = "A" AND att_schshift ="R" AND (coa_out < TIME(att_schout) OR att_bioout < att_schout)
							THEN IF(att_date = unders.utm_date,"","Undertime")
						WHEN lea_dtype = "H" AND lea_dampm = "A" AND att_schshift ="F" AND @flex_set = 1 AND (TIME(att_schout) > coa_out OR att_schout > att_bioout)
							THEN IF(att_date = unders.utm_date,"","Undertime")
						WHEN lea_dtype = "H" AND lea_dampm = "A" AND att_schshift ="F" AND (HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(coa_in,coa_out))) OR HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(att_bioin,att_bioout))))
							THEN IF(att_date = unders.utm_date,"","Undertime")

						WHEN att_schshift ="F" AND @flex_set = 1 AND lea_dtype = "H" AND lea_dampm = "P" AND (att_bioin > att_schin OR coa_in > TIME(att_schin)) AND @today >= att_date
							THEN "Late"
						WHEN att_schshift !="F" AND lea_dtype = "H" AND lea_dampm = "P" AND (att_bioin > att_schin OR coa_in > TIME(att_schin)) AND @today >= att_date
							THEN "Late"
						WHEN lea_dtype = "H" AND lea_dampm = "P" AND att_schshift ="R"
                        AND (coa_out < SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2) OR TIME(att_bioout) < SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2))
							THEN IF(att_date = unders.utm_date,"","Undertime")
						WHEN lea_dtype = "H" AND lea_dampm = "P" AND att_schshift ="F" AND @flex_set = 1
                        AND (SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2) > coa_out OR SEC_TO_TIME((TIME_TO_SEC(att_schin) + TIME_TO_SEC(att_schout)) / 2) > TIME(att_bioout))
							THEN IF(att_date = unders.utm_date,"","Undertime")
						WHEN att_schshift ="F" AND (HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(coa_in,coa_out))) OR HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(att_bioin,att_bioout))))
							THEN IF(att_date = unders.utm_date,"","Undertime")

						ELSE ""
                    END
				WHEN att_date = coas.coa_ddate
					THEN
						CASE

							WHEN (coa_in IS NULL AND att_bioin IS NULL) AND @today > att_date
								THEN "Missing Log (No Log in)"
							WHEN (coa_in IS NULL AND coa_out IS NOT NULL AND att_bioin IS NULL) AND @today = att_date
								THEN "Missing Log (No Log in)"
							WHEN (coa_out IS NULL AND att_bioout IS NULL) AND @today > att_date
								THEN "Missing Log (No Log out)"
							WHEN att_schshift ="F" AND @flex_set= 1 AND (CONCAT(att_date," ",coa_in) > att_schin OR (att_bioin > att_schin AND coa_in IS NULL)) AND @today >= att_date
								THEN "Late"
							WHEN att_schshift !="F" AND (CONCAT(att_date," ",coa_in) > att_schin OR (att_bioin > att_schin AND coa_in IS NULL)) AND @today >= att_date
								THEN "Late"
							WHEN att_schshift ="R" AND (coa_out < TIME(att_schout) OR att_bioout < att_schout)
								 THEN IF(att_date = unders.utm_date,"","Undertime")
							WHEN att_schshift ="F" AND @flex_set=1 AND (coa_out < TIME(att_schout) OR (att_bioout < att_schout))
								THEN IF(att_date = unders.utm_date,"","Undertime")
							WHEN att_schshift ="F" AND (HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(coa_in,coa_out))) OR (HOUR(TIME(att_schhrs)) > (HOUR(TIMEDIFF(att_bioin,att_bioout)))))
								THEN IF(att_date = unders.utm_date,"","Undertime")
							ELSE ""
                        END
				-- WHEN att_bioin IS NULL AND att_bioout IS NULL AND @today = att_date
					-- THEN "Missing Log (No Logs)"

				WHEN att_bioin IS NULL and not isnull(att_bioout) AND @today >= att_date
					THEN "Missing Log (No Log in)"
				WHEN not isnull(att_bioin) and att_bioout IS NULL AND @today >= att_date
					THEN "Missing Log (No Log out)"
				-- WHEN att_bioin IS NULL AND att_bioout IS NOT NULL AND @today = att_date
				-- 	THEN "Missing Log (No Log in)"

				WHEN att_schshift ="F" AND @flex_set= 1 AND att_bioin > att_schin AND @today >= att_date
					THEN "Late"
				WHEN att_schshift != "F" AND att_bioin > att_schin AND @today >= att_date
					THEN "Late"
				WHEN att_schshift ="R" AND att_bioout < att_schout
					THEN IF(att_date = unders.utm_date,"","Undertime")
				WHEN att_schshift ="F" AND att_schout > att_bioout AND @flex_set = 1
					THEN IF(att_date = unders.utm_date,"","Undertime")
				WHEN att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))
					THEN IF(att_date = unders.utm_date,"","Undertime")
				WHEN att_bioout IS NULL AND att_schout < now() AND @today = att_date
					THEN "Need to logout"
				WHEN att_bioin IS NULL AND now() < att_schin AND att_bioout IS NULL AND @today = att_date
					THEN CONCAT("Expected in ",TIME_FORMAT(att_schin,"%h:%i %p"))
				WHEN att_schshift ="F" AND @flex_set= 1 AND att_bioin IS NULL AND now() > att_schin AND att_bioout IS NULL AND @today = att_date
					THEN "Running Late"
				WHEN att_schshift !="F" AND att_bioin IS NULL AND now() > att_schin AND att_bioout IS NULL AND @today = att_date
					THEN "Running Late"
				WHEN @today > att_date AND att_bioin IS NULL AND att_bioout IS NULL
					THEN "Absent"
				ELSE ""
            END as msg,

            CASE
				WHEN (att_date BETWEEN leas.lea_sfrom AND leas.lea_sto)
					AND ((@today > att_date AND att_bioin IS NULL AND att_bioout IS NULL ) OR
					(att_bioout IS NULL AND @today > att_date) OR
                    (att_bioin IS NULL AND @today > att_date) OR
					(att_bioin IS NULL AND att_bioout IS NOT NULL AND @today = att_date) OR
                    (att_schshift ="R" AND att_bioout < att_schout) OR
					(att_schshift ="F" AND @flex_set = 1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))))
					THEN "A"
				WHEN (att_date BETWEEN fleas.lea_sfrom AND fleas.lea_sto)
					AND ((@today > att_date AND att_bioin IS NULL AND att_bioout IS NULL ) OR
					(att_bioout IS NULL AND @today > att_date) OR
                    (att_bioin IS NULL AND @today > att_date) OR
					(att_bioin IS NULL AND att_bioout IS NOT NULL AND @today = att_date) OR
                    (att_schshift ="R" AND att_bioout < att_schout) OR
					(att_schshift ="F" AND @flex_set = 1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))))
					THEN "F"
				WHEN (att_date = coas.coa_ddate)
					AND ((@today > att_date AND att_bioin IS NULL AND att_bioout IS NULL ) OR
					(att_bioout IS NULL AND @today > att_date) OR
                    (att_bioin IS NULL AND @today > att_date) OR
					(att_bioin IS NULL AND att_bioout IS NOT NULL AND @today = att_date) OR
                    (att_schshift ="R" AND att_bioout < att_schout) OR
					(att_schshift ="F" AND @flex_set = 1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))) OR
                    (att_bioin > att_schin AND @today >= att_date))
					THEN "A"
				WHEN (att_date = fcoas.coa_ddate)
					AND ((@today > att_date AND att_bioin IS NULL AND att_bioout IS NULL ) OR
					(att_bioout IS NULL AND @today > att_date) OR
                    (att_bioin IS NULL AND @today > att_date) OR
					(att_bioin IS NULL AND att_bioout IS NOT NULL AND @today = att_date) OR
                    (att_schshift ="R" AND att_bioout < att_schout) OR
					(att_schshift ="F" AND @flex_set = 1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))) OR
                    (att_bioin > att_schin AND @today >= att_date))
					THEN "F"
				WHEN (att_date = unders.utm_date)
					AND ((att_schshift ="R" AND att_bioout < att_bioout) OR
					(att_schshift ="F" AND @flex_set = 1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))))
					THEN "A"
				WHEN (att_date = funders.utm_date)
					AND ((att_schshift ="R" AND att_bioout < att_bioout) OR
					(att_schshift ="F" AND @flex_set = 1 AND att_schout > att_bioout) OR
					(att_schshift ="F" AND att_schhrs > (HOUR(TIMEDIFF(att_bioin,att_bioout)))))
					THEN "F"
				ELSE "N"
            END as filed

		FROM
			(
				SELECT
					att_date, att_emp,
                    IF(att_reqschin IS NULL, att_schin,att_reqschin) as att_schin,
                    IF(att_reqschout IS NULL, att_schout,att_reqschout) as att_schout,
                    IF(att_reqschbin IS NULL,att_schbin,att_reqschbin) as att_schbin,
                    IF(att_reqschbout IS NULL,att_schbout,att_reqschbout) as att_schbout,
					IF(att_reqschhrs IS NULL,att_schhrs,att_reqschhrs) as att_schhrs,
                    IF(att_reqschshift IS NULL,att_schshift,att_reqschshift) as att_schshift,
                    IF(att_reqschbreak IS NULL,att_schbreak,att_reqschbreak) as att_schbreak,
                    IF(att_reqrestday IS NULL,att_restday,att_reqrestday) as att_restday,
                    att_holiday, att_bioin, att_bioout,att_wrkhrs, att_logdate,att_brkin,att_brkout
				FROM attendance WHERE att_emp = emp_id AND MONTH(@today - INTERVAL 15 DAY) = MONTH(att_date) AND
                (IF (@is_first_half = 1,
						DAYOFMONTH(att_date) <= LAST_DAY(att_date)
						AND DAYOFMONTH(att_date) > 15
					,
						DAYOFMONTH(att_date) <= 15
				))
            ) as main

            LEFT JOIN (
			SELECT hol_name,hol_date,hol_repeat FROM holiday WHERE hol_status = 1
        ) as holi ON main.att_date = holi.hol_date -- IF(hol_repeat= "Yearly",MONTH(main.att_date)=MONTH(holi.hol_date) AND DAY(main.att_date)=DAY(holi.hol_date),
			-- main.att_date = holi.hol_date)

			LEFT JOIN (
				SELECT lea_sfrom,lea_sto,ld.lea_dtype,lea_dampm,lea_ddate FROM leave_summary as ls
					LEFT JOIN leave_detail as ld ON ls.lea_sid = ld.lea_dpk
				WHERE
				 lea_semp = emp_id
					AND lea_sstatus = 1
			) as leas ON main.att_date =leas.lea_ddate

            LEFT JOIN (
				SELECT dtl.coa_ddate, MAX(coa_in) as coa_in, MAX(coa_out) as coa_out FROM (
					SELECT coa_semp,coa_ddate , MIN(coa_dtime) as coa_in,null as coa_out FROM
					coa_summary as smr
                    LEFT JOIN coa_detail ON smr.coa_sid=coa_dpk
						WHERE smr.coa_sstatus = 1 AND coa_dtype = "I"
					GROUP BY coa_ddate,coa_semp
				UNION ALL
					SELECT coa_semp,coa_ddate ,null as coa_in, MAX(coa_dtime) as coa_out FROM
					coa_summary as smr
                     LEFT JOIN coa_detail ON smr.coa_sid=coa_dpk
						WHERE smr.coa_sstatus = 1 AND coa_dtype = "O"
					GROUP BY coa_ddate,coa_semp
				) as dtl  WHERE coa_semp = emp_id
				GROUP BY coa_ddate,coa_semp
			) as coas ON main.att_date = coas.coa_ddate

			LEFT JOIN (
				SELECT utm_date,MAX(utm_logdate) FROM undertime
					WHERE utm_emp = emp_id AND utm_status = 1
			) as unders ON main.att_date = unders.utm_date

			LEFT JOIN (
				SELECT utm_date,MAX(utm_logdate) FROM undertime
					WHERE utm_emp = emp_id AND utm_status = 0
			) as funders ON main.att_date = funders.utm_date

			LEFT JOIN (
				SELECT lea_sfrom,lea_sto,lea_ddate FROM leave_summary as ls
					LEFT JOIN leave_detail as ld ON ls.lea_sid = ld.lea_dpk
				WHERE
				 lea_semp = emp_id
					AND lea_sstatus = 0
			) as fleas ON main.att_date= fleas.lea_ddate

			LEFT JOIN (
				SELECT dtl.coa_ddate FROM (
					SELECT coa_semp,coa_ddate , MIN(coa_dtime) as coa_in,null as coa_out FROM
					coa_summary as smr
                    LEFT JOIN coa_detail ON smr.coa_sid=coa_dpk
						WHERE smr.coa_sstatus = 0 AND coa_dtype = "I"
					GROUP BY coa_ddate,coa_semp
				UNION ALL
					SELECT coa_semp,coa_ddate ,null as coa_in, MAX(coa_dtime) as coa_out FROM
					coa_summary as smr
                     LEFT JOIN coa_detail ON smr.coa_sid=coa_dpk
						WHERE smr.coa_sstatus = 0 AND coa_dtype = "O"
					GROUP BY coa_ddate,coa_semp
				) as dtl  WHERE coa_semp = emp_id
				GROUP BY coa_ddate,coa_semp
			) as fcoas ON main.att_date = fcoas.coa_ddate

    ) as prev_cutoff  WHERE msg IS NOT NULL AND msg != "Rest Day" AND msg !="Leave Approved" AND msg !="" AND msg != "Attendance Changed" AND msg !="Undertime Approved" AND hol_name IS NULL)

) as bio_grid ORDER BY bio_date DESC;
