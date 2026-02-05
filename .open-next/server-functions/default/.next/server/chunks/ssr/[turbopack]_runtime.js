const RUNTIME_PUBLIC_PATH = "server/chunks/ssr/[turbopack]_runtime.js";
const RELATIVE_ROOT_PATH = "..";
const ASSET_PREFIX = "/_next/";
/**
 * This file contains runtime types and functions that are shared between all
 * TurboPack ECMAScript runtimes.
 *
 * It will be prepended to the runtime code of each runtime.
 */ /* eslint-disable @typescript-eslint/no-unused-vars */ /// <reference path="./runtime-types.d.ts" />
const REEXPORTED_OBJECTS = new WeakMap();
/**
 * Constructs the `__turbopack_context__` object for a module.
 */ function Context(module, exports) {
    this.m = module;
    // We need to store this here instead of accessing it from the module object to:
    // 1. Make it available to factories directly, since we rewrite `this` to
    //    `__turbopack_context__.e` in CJS modules.
    // 2. Support async modules which rewrite `module.exports` to a promise, so we
    //    can still access the original exports object from functions like
    //    `esmExport`
    // Ideally we could find a new approach for async modules and drop this property altogether.
    this.e = exports;
}
const contextPrototype = Context.prototype;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const toStringTag = typeof Symbol !== 'undefined' && Symbol.toStringTag;
function defineProp(obj, name, options) {
    if (!hasOwnProperty.call(obj, name)) Object.defineProperty(obj, name, options);
}
function getOverwrittenModule(moduleCache, id) {
    let module = moduleCache[id];
    if (!module) {
        // This is invoked when a module is merged into another module, thus it wasn't invoked via
        // instantiateModule and the cache entry wasn't created yet.
        module = createModuleObject(id);
        moduleCache[id] = module;
    }
    return module;
}
/**
 * Creates the module object. Only done here to ensure all module objects have the same shape.
 */ function createModuleObject(id) {
    return {
        exports: {},
        error: undefined,
        id,
        namespaceObject: undefined
    };
}
const BindingTag_Value = 0;
/**
 * Adds the getters to the exports object.
 */ function esm(exports, bindings) {
    defineProp(exports, '__esModule', {
        value: true
    });
    if (toStringTag) defineProp(exports, toStringTag, {
        value: 'Module'
    });
    let i = 0;
    while(i < bindings.length){
        const propName = bindings[i++];
        const tagOrFunction = bindings[i++];
        if (typeof tagOrFunction === 'number') {
            if (tagOrFunction === BindingTag_Value) {
                defineProp(exports, propName, {
                    value: bindings[i++],
                    enumerable: true,
                    writable: false
                });
            } else {
                throw new Error(`unexpected tag: ${tagOrFunction}`);
            }
        } else {
            const getterFn = tagOrFunction;
            if (typeof bindings[i] === 'function') {
                const setterFn = bindings[i++];
                defineProp(exports, propName, {
                    get: getterFn,
                    set: setterFn,
                    enumerable: true
                });
            } else {
                defineProp(exports, propName, {
                    get: getterFn,
                    enumerable: true
                });
            }
        }
    }
    Object.seal(exports);
}
/**
 * Makes the module an ESM with exports
 */ function esmExport(bindings, id) {
    let module;
    let exports;
    if (id != null) {
        module = getOverwrittenModule(this.c, id);
        exports = module.exports;
    } else {
        module = this.m;
        exports = this.e;
    }
    module.namespaceObject = exports;
    esm(exports, bindings);
}
contextPrototype.s = esmExport;
function ensureDynamicExports(module, exports) {
    let reexportedObjects = REEXPORTED_OBJECTS.get(module);
    if (!reexportedObjects) {
        REEXPORTED_OBJECTS.set(module, reexportedObjects = []);
        module.exports = module.namespaceObject = new Proxy(exports, {
            get (target, prop) {
                if (hasOwnProperty.call(target, prop) || prop === 'default' || prop === '__esModule') {
                    return Reflect.get(target, prop);
                }
                for (const obj of reexportedObjects){
                    const value = Reflect.get(obj, prop);
                    if (value !== undefined) return value;
                }
                return undefined;
            },
            ownKeys (target) {
                const keys = Reflect.ownKeys(target);
                for (const obj of reexportedObjects){
                    for (const key of Reflect.ownKeys(obj)){
                        if (key !== 'default' && !keys.includes(key)) keys.push(key);
                    }
                }
                return keys;
            }
        });
    }
    return reexportedObjects;
}
/**
 * Dynamically exports properties from an object
 */ function dynamicExport(object, id) {
    let module;
    let exports;
    if (id != null) {
        module = getOverwrittenModule(this.c, id);
        exports = module.exports;
    } else {
        module = this.m;
        exports = this.e;
    }
    const reexportedObjects = ensureDynamicExports(module, exports);
    if (typeof object === 'object' && object !== null) {
        reexportedObjects.push(object);
    }
}
contextPrototype.j = dynamicExport;
function exportValue(value, id) {
    let module;
    if (id != null) {
        module = getOverwrittenModule(this.c, id);
    } else {
        module = this.m;
    }
    module.exports = value;
}
contextPrototype.v = exportValue;
function exportNamespace(namespace, id) {
    let module;
    if (id != null) {
        module = getOverwrittenModule(this.c, id);
    } else {
        module = this.m;
    }
    module.exports = module.namespaceObject = namespace;
}
contextPrototype.n = exportNamespace;
function createGetter(obj, key) {
    return ()=>obj[key];
}
/**
 * @returns prototype of the object
 */ const getProto = Object.getPrototypeOf ? (obj)=>Object.getPrototypeOf(obj) : (obj)=>obj.__proto__;
/** Prototypes that are not expanded for exports */ const LEAF_PROTOTYPES = [
    null,
    getProto({}),
    getProto([]),
    getProto(getProto)
];
/**
 * @param raw
 * @param ns
 * @param allowExportDefault
 *   * `false`: will have the raw module as default export
 *   * `true`: will have the default property as default export
 */ function interopEsm(raw, ns, allowExportDefault) {
    const bindings = [];
    let defaultLocation = -1;
    for(let current = raw; (typeof current === 'object' || typeof current === 'function') && !LEAF_PROTOTYPES.includes(current); current = getProto(current)){
        for (const key of Object.getOwnPropertyNames(current)){
            bindings.push(key, createGetter(raw, key));
            if (defaultLocation === -1 && key === 'default') {
                defaultLocation = bindings.length - 1;
            }
        }
    }
    // this is not really correct
    // we should set the `default` getter if the imported module is a `.cjs file`
    if (!(allowExportDefault && defaultLocation >= 0)) {
        // Replace the binding with one for the namespace itself in order to preserve iteration order.
        if (defaultLocation >= 0) {
            // Replace the getter with the value
            bindings.splice(defaultLocation, 1, BindingTag_Value, raw);
        } else {
            bindings.push('default', BindingTag_Value, raw);
        }
    }
    esm(ns, bindings);
    return ns;
}
function createNS(raw) {
    if (typeof raw === 'function') {
        return function(...args) {
            return raw.apply(this, args);
        };
    } else {
        return Object.create(null);
    }
}
function esmImport(id) {
    const module = getOrInstantiateModuleFromParent(id, this.m);
    // any ES module has to have `module.namespaceObject` defined.
    if (module.namespaceObject) return module.namespaceObject;
    // only ESM can be an async module, so we don't need to worry about exports being a promise here.
    const raw = module.exports;
    return module.namespaceObject = interopEsm(raw, createNS(raw), raw && raw.__esModule);
}
contextPrototype.i = esmImport;
function asyncLoader(moduleId) {
    const loader = this.r(moduleId);
    return loader(esmImport.bind(this));
}
contextPrototype.A = asyncLoader;
// Add a simple runtime require so that environments without one can still pass
// `typeof require` CommonJS checks so that exports are correctly registered.
const runtimeRequire = // @ts-ignore
typeof require === 'function' ? require : function require1() {
    throw new Error('Unexpected use of runtime require');
};
contextPrototype.t = runtimeRequire;
function commonJsRequire(id) {
    return getOrInstantiateModuleFromParent(id, this.m).exports;
}
contextPrototype.r = commonJsRequire;
/**
 * Remove fragments and query parameters since they are never part of the context map keys
 *
 * This matches how we parse patterns at resolving time.  Arguably we should only do this for
 * strings passed to `import` but the resolve does it for `import` and `require` and so we do
 * here as well.
 */ function parseRequest(request) {
    // Per the URI spec fragments can contain `?` characters, so we should trim it off first
    // https://datatracker.ietf.org/doc/html/rfc3986#section-3.5
    const hashIndex = request.indexOf('#');
    if (hashIndex !== -1) {
        request = request.substring(0, hashIndex);
    }
    const queryIndex = request.indexOf('?');
    if (queryIndex !== -1) {
        request = request.substring(0, queryIndex);
    }
    return request;
}
/**
 * `require.context` and require/import expression runtime.
 */ function moduleContext(map) {
    function moduleContext(id) {
        id = parseRequest(id);
        if (hasOwnProperty.call(map, id)) {
            return map[id].module();
        }
        const e = new Error(`Cannot find module '${id}'`);
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    }
    moduleContext.keys = ()=>{
        return Object.keys(map);
    };
    moduleContext.resolve = (id)=>{
        id = parseRequest(id);
        if (hasOwnProperty.call(map, id)) {
            return map[id].id();
        }
        const e = new Error(`Cannot find module '${id}'`);
        e.code = 'MODULE_NOT_FOUND';
        throw e;
    };
    moduleContext.import = async (id)=>{
        return await moduleContext(id);
    };
    return moduleContext;
}
contextPrototype.f = moduleContext;
/**
 * Returns the path of a chunk defined by its data.
 */ function getChunkPath(chunkData) {
    return typeof chunkData === 'string' ? chunkData : chunkData.path;
}
function isPromise(maybePromise) {
    return maybePromise != null && typeof maybePromise === 'object' && 'then' in maybePromise && typeof maybePromise.then === 'function';
}
function isAsyncModuleExt(obj) {
    return turbopackQueues in obj;
}
function createPromise() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej)=>{
        reject = rej;
        resolve = res;
    });
    return {
        promise,
        resolve: resolve,
        reject: reject
    };
}
// Load the CompressedmoduleFactories of a chunk into the `moduleFactories` Map.
// The CompressedModuleFactories format is
// - 1 or more module ids
// - a module factory function
// So walking this is a little complex but the flat structure is also fast to
// traverse, we can use `typeof` operators to distinguish the two cases.
function installCompressedModuleFactories(chunkModules, offset, moduleFactories, newModuleId) {
    let i = offset;
    while(i < chunkModules.length){
        let moduleId = chunkModules[i];
        let end = i + 1;
        // Find our factory function
        while(end < chunkModules.length && typeof chunkModules[end] !== 'function'){
            end++;
        }
        if (end === chunkModules.length) {
            throw new Error('malformed chunk format, expected a factory function');
        }
        // Each chunk item has a 'primary id' and optional additional ids. If the primary id is already
        // present we know all the additional ids are also present, so we don't need to check.
        if (!moduleFactories.has(moduleId)) {
            const moduleFactoryFn = chunkModules[end];
            applyModuleFactoryName(moduleFactoryFn);
            newModuleId?.(moduleId);
            for(; i < end; i++){
                moduleId = chunkModules[i];
                moduleFactories.set(moduleId, moduleFactoryFn);
            }
        }
        i = end + 1; // end is pointing at the last factory advance to the next id or the end of the array.
    }
}
// everything below is adapted from webpack
// https://github.com/webpack/webpack/blob/6be4065ade1e252c1d8dcba4af0f43e32af1bdc1/lib/runtime/AsyncModuleRuntimeModule.js#L13
const turbopackQueues = Symbol('turbopack queues');
const turbopackExports = Symbol('turbopack exports');
const turbopackError = Symbol('turbopack error');
function resolveQueue(queue) {
    if (queue && queue.status !== 1) {
        queue.status = 1;
        queue.forEach((fn)=>fn.queueCount--);
        queue.forEach((fn)=>fn.queueCount-- ? fn.queueCount++ : fn());
    }
}
function wrapDeps(deps) {
    return deps.map((dep)=>{
        if (dep !== null && typeof dep === 'object') {
            if (isAsyncModuleExt(dep)) return dep;
            if (isPromise(dep)) {
                const queue = Object.assign([], {
                    status: 0
                });
                const obj = {
                    [turbopackExports]: {},
                    [turbopackQueues]: (fn)=>fn(queue)
                };
                dep.then((res)=>{
                    obj[turbopackExports] = res;
                    resolveQueue(queue);
                }, (err)=>{
                    obj[turbopackError] = err;
                    resolveQueue(queue);
                });
                return obj;
            }
        }
        return {
            [turbopackExports]: dep,
            [turbopackQueues]: ()=>{}
        };
    });
}
function asyncModule(body, hasAwait) {
    const module = this.m;
    const queue = hasAwait ? Object.assign([], {
        status: -1
    }) : undefined;
    const depQueues = new Set();
    const { resolve, reject, promise: rawPromise } = createPromise();
    const promise = Object.assign(rawPromise, {
        [turbopackExports]: module.exports,
        [turbopackQueues]: (fn)=>{
            queue && fn(queue);
            depQueues.forEach(fn);
            promise['catch'](()=>{});
        }
    });
    const attributes = {
        get () {
            return promise;
        },
        set (v) {
            // Calling `esmExport` leads to this.
            if (v !== promise) {
                promise[turbopackExports] = v;
            }
        }
    };
    Object.defineProperty(module, 'exports', attributes);
    Object.defineProperty(module, 'namespaceObject', attributes);
    function handleAsyncDependencies(deps) {
        const currentDeps = wrapDeps(deps);
        const getResult = ()=>currentDeps.map((d)=>{
                if (d[turbopackError]) throw d[turbopackError];
                return d[turbopackExports];
            });
        const { promise, resolve } = createPromise();
        const fn = Object.assign(()=>resolve(getResult), {
            queueCount: 0
        });
        function fnQueue(q) {
            if (q !== queue && !depQueues.has(q)) {
                depQueues.add(q);
                if (q && q.status === 0) {
                    fn.queueCount++;
                    q.push(fn);
                }
            }
        }
        currentDeps.map((dep)=>dep[turbopackQueues](fnQueue));
        return fn.queueCount ? promise : getResult();
    }
    function asyncResult(err) {
        if (err) {
            reject(promise[turbopackError] = err);
        } else {
            resolve(promise[turbopackExports]);
        }
        resolveQueue(queue);
    }
    body(handleAsyncDependencies, asyncResult);
    if (queue && queue.status === -1) {
        queue.status = 0;
    }
}
contextPrototype.a = asyncModule;
/**
 * A pseudo "fake" URL object to resolve to its relative path.
 *
 * When UrlRewriteBehavior is set to relative, calls to the `new URL()` will construct url without base using this
 * runtime function to generate context-agnostic urls between different rendering context, i.e ssr / client to avoid
 * hydration mismatch.
 *
 * This is based on webpack's existing implementation:
 * https://github.com/webpack/webpack/blob/87660921808566ef3b8796f8df61bd79fc026108/lib/runtime/RelativeUrlRuntimeModule.js
 */ const relativeURL = function relativeURL(inputUrl) {
    const realUrl = new URL(inputUrl, 'x:/');
    const values = {};
    for(const key in realUrl)values[key] = realUrl[key];
    values.href = inputUrl;
    values.pathname = inputUrl.replace(/[?#].*/, '');
    values.origin = values.protocol = '';
    values.toString = values.toJSON = (..._args)=>inputUrl;
    for(const key in values)Object.defineProperty(this, key, {
        enumerable: true,
        configurable: true,
        value: values[key]
    });
};
relativeURL.prototype = URL.prototype;
contextPrototype.U = relativeURL;
/**
 * Utility function to ensure all variants of an enum are handled.
 */ function invariant(never, computeMessage) {
    throw new Error(`Invariant: ${computeMessage(never)}`);
}
/**
 * A stub function to make `require` available but non-functional in ESM.
 */ function requireStub(_moduleId) {
    throw new Error('dynamic usage of require is not supported');
}
contextPrototype.z = requireStub;
// Make `globalThis` available to the module in a way that cannot be shadowed by a local variable.
contextPrototype.g = globalThis;
function applyModuleFactoryName(factory) {
    // Give the module factory a nice name to improve stack traces.
    Object.defineProperty(factory, 'name', {
        value: 'module evaluation'
    });
}
/// <reference path="../shared/runtime-utils.ts" />
/// A 'base' utilities to support runtime can have externals.
/// Currently this is for node.js / edge runtime both.
/// If a fn requires node.js specific behavior, it should be placed in `node-external-utils` instead.
async function externalImport(id) {
    let raw;
    try {
        switch (id) {
  case "next/dist/compiled/@vercel/og/index.node.js":
    raw = await import("next/dist/compiled/@vercel/og/index.edge.js");
    break;
  default:
    raw = await import(id);
};
    } catch (err) {
        // TODO(alexkirsz) This can happen when a client-side module tries to load
        // an external module we don't provide a shim for (e.g. querystring, url).
        // For now, we fail semi-silently, but in the future this should be a
        // compilation error.
        throw new Error(`Failed to load external module ${id}: ${err}`);
    }
    if (raw && raw.__esModule && raw.default && 'default' in raw.default) {
        return interopEsm(raw.default, createNS(raw), true);
    }
    return raw;
}
contextPrototype.y = externalImport;
function externalRequire(id, thunk, esm = false) {
    let raw;
    try {
        raw = thunk();
    } catch (err) {
        // TODO(alexkirsz) This can happen when a client-side module tries to load
        // an external module we don't provide a shim for (e.g. querystring, url).
        // For now, we fail semi-silently, but in the future this should be a
        // compilation error.
        throw new Error(`Failed to load external module ${id}: ${err}`);
    }
    if (!esm || raw.__esModule) {
        return raw;
    }
    return interopEsm(raw, createNS(raw), true);
}
externalRequire.resolve = (id, options)=>{
    return require.resolve(id, options);
};
contextPrototype.x = externalRequire;
/* eslint-disable @typescript-eslint/no-unused-vars */ const path = require('path');
const relativePathToRuntimeRoot = path.relative(RUNTIME_PUBLIC_PATH, '.');
// Compute the relative path to the `distDir`.
const relativePathToDistRoot = path.join(relativePathToRuntimeRoot, RELATIVE_ROOT_PATH);
const RUNTIME_ROOT = path.resolve(__filename, relativePathToRuntimeRoot);
// Compute the absolute path to the root, by stripping distDir from the absolute path to this file.
const ABSOLUTE_ROOT = path.resolve(__filename, relativePathToDistRoot);
/**
 * Returns an absolute path to the given module path.
 * Module path should be relative, either path to a file or a directory.
 *
 * This fn allows to calculate an absolute path for some global static values, such as
 * `__dirname` or `import.meta.url` that Turbopack will not embeds in compile time.
 * See ImportMetaBinding::code_generation for the usage.
 */ function resolveAbsolutePath(modulePath) {
    if (modulePath) {
        return path.join(ABSOLUTE_ROOT, modulePath);
    }
    return ABSOLUTE_ROOT;
}
Context.prototype.P = resolveAbsolutePath;
/* eslint-disable @typescript-eslint/no-unused-vars */ /// <reference path="../shared/runtime-utils.ts" />
function readWebAssemblyAsResponse(path) {
    const { createReadStream } = require('fs');
    const { Readable } = require('stream');
    const stream = createReadStream(path);
    // @ts-ignore unfortunately there's a slight type mismatch with the stream.
    return new Response(Readable.toWeb(stream), {
        headers: {
            'content-type': 'application/wasm'
        }
    });
}
async function compileWebAssemblyFromPath(path) {
    const response = readWebAssemblyAsResponse(path);
    return await WebAssembly.compileStreaming(response);
}
async function instantiateWebAssemblyFromPath(path, importsObj) {
    const response = readWebAssemblyAsResponse(path);
    const { instance } = await WebAssembly.instantiateStreaming(response, importsObj);
    return instance.exports;
}
/* eslint-disable @typescript-eslint/no-unused-vars */ /// <reference path="../shared/runtime-utils.ts" />
/// <reference path="../shared-node/base-externals-utils.ts" />
/// <reference path="../shared-node/node-externals-utils.ts" />
/// <reference path="../shared-node/node-wasm-utils.ts" />
var SourceType = /*#__PURE__*/ function(SourceType) {
    /**
   * The module was instantiated because it was included in an evaluated chunk's
   * runtime.
   * SourceData is a ChunkPath.
   */ SourceType[SourceType["Runtime"] = 0] = "Runtime";
    /**
   * The module was instantiated because a parent module imported it.
   * SourceData is a ModuleId.
   */ SourceType[SourceType["Parent"] = 1] = "Parent";
    return SourceType;
}(SourceType || {});
process.env.TURBOPACK = '1';
const nodeContextPrototype = Context.prototype;
const url = require('url');
const moduleFactories = new Map();
nodeContextPrototype.M = moduleFactories;
const moduleCache = Object.create(null);
nodeContextPrototype.c = moduleCache;
/**
 * Returns an absolute path to the given module's id.
 */ function resolvePathFromModule(moduleId) {
    const exported = this.r(moduleId);
    const exportedPath = exported?.default ?? exported;
    if (typeof exportedPath !== 'string') {
        return exported;
    }
    const strippedAssetPrefix = exportedPath.slice(ASSET_PREFIX.length);
    const resolved = path.resolve(RUNTIME_ROOT, strippedAssetPrefix);
    return url.pathToFileURL(resolved).href;
}
nodeContextPrototype.R = resolvePathFromModule;
function loadRuntimeChunk(sourcePath, chunkData) {
    if (typeof chunkData === 'string') {
        loadRuntimeChunkPath(sourcePath, chunkData);
    } else {
        loadRuntimeChunkPath(sourcePath, chunkData.path);
    }
}
const loadedChunks = new Set();
const unsupportedLoadChunk = Promise.resolve(undefined);
const loadedChunk = Promise.resolve(undefined);
const chunkCache = new Map();
function clearChunkCache() {
    chunkCache.clear();
}
function loadRuntimeChunkPath(sourcePath, chunkPath) {
    if (!isJs(chunkPath)) {
        // We only support loading JS chunks in Node.js.
        // This branch can be hit when trying to load a CSS chunk.
        return;
    }
    if (loadedChunks.has(chunkPath)) {
        return;
    }
    try {
        const resolved = path.resolve(RUNTIME_ROOT, chunkPath);
        const chunkModules = requireChunk(chunkPath);
        installCompressedModuleFactories(chunkModules, 0, moduleFactories);
        loadedChunks.add(chunkPath);
    } catch (cause) {
        let errorMessage = `Failed to load chunk ${chunkPath}`;
        if (sourcePath) {
            errorMessage += ` from runtime for chunk ${sourcePath}`;
        }
        const error = new Error(errorMessage, {
            cause
        });
        error.name = 'ChunkLoadError';
        throw error;
    }
}
function loadChunkAsync(chunkData) {
    const chunkPath = typeof chunkData === 'string' ? chunkData : chunkData.path;
    if (!isJs(chunkPath)) {
        // We only support loading JS chunks in Node.js.
        // This branch can be hit when trying to load a CSS chunk.
        return unsupportedLoadChunk;
    }
    let entry = chunkCache.get(chunkPath);
    if (entry === undefined) {
        try {
            // resolve to an absolute path to simplify `require` handling
            const resolved = path.resolve(RUNTIME_ROOT, chunkPath);
            // TODO: consider switching to `import()` to enable concurrent chunk loading and async file io
            // However this is incompatible with hot reloading (since `import` doesn't use the require cache)
            const chunkModules = requireChunk(chunkPath);
            installCompressedModuleFactories(chunkModules, 0, moduleFactories);
            entry = loadedChunk;
        } catch (cause) {
            const errorMessage = `Failed to load chunk ${chunkPath} from module ${this.m.id}`;
            const error = new Error(errorMessage, {
                cause
            });
            error.name = 'ChunkLoadError';
            // Cache the failure promise, future requests will also get this same rejection
            entry = Promise.reject(error);
        }
        chunkCache.set(chunkPath, entry);
    }
    // TODO: Return an instrumented Promise that React can use instead of relying on referential equality.
    return entry;
}
contextPrototype.l = loadChunkAsync;
function loadChunkAsyncByUrl(chunkUrl) {
    const path1 = url.fileURLToPath(new URL(chunkUrl, RUNTIME_ROOT));
    return loadChunkAsync.call(this, path1);
}
contextPrototype.L = loadChunkAsyncByUrl;
function loadWebAssembly(chunkPath, _edgeModule, imports) {
    const resolved = path.resolve(RUNTIME_ROOT, chunkPath);
    return instantiateWebAssemblyFromPath(resolved, imports);
}
contextPrototype.w = loadWebAssembly;
function loadWebAssemblyModule(chunkPath, _edgeModule) {
    const resolved = path.resolve(RUNTIME_ROOT, chunkPath);
    return compileWebAssemblyFromPath(resolved);
}
contextPrototype.u = loadWebAssemblyModule;
function getWorkerBlobURL(_chunks) {
    throw new Error('Worker blobs are not implemented yet for Node.js');
}
nodeContextPrototype.b = getWorkerBlobURL;
function instantiateModule(id, sourceType, sourceData) {
    const moduleFactory = moduleFactories.get(id);
    if (typeof moduleFactory !== 'function') {
        // This can happen if modules incorrectly handle HMR disposes/updates,
        // e.g. when they keep a `setTimeout` around which still executes old code
        // and contains e.g. a `require("something")` call.
        let instantiationReason;
        switch(sourceType){
            case 0:
                instantiationReason = `as a runtime entry of chunk ${sourceData}`;
                break;
            case 1:
                instantiationReason = `because it was required from module ${sourceData}`;
                break;
            default:
                invariant(sourceType, (sourceType)=>`Unknown source type: ${sourceType}`);
        }
        throw new Error(`Module ${id} was instantiated ${instantiationReason}, but the module factory is not available.`);
    }
    const module1 = createModuleObject(id);
    const exports = module1.exports;
    moduleCache[id] = module1;
    const context = new Context(module1, exports);
    // NOTE(alexkirsz) This can fail when the module encounters a runtime error.
    try {
        moduleFactory(context, module1, exports);
    } catch (error) {
        module1.error = error;
        throw error;
    }
    module1.loaded = true;
    if (module1.namespaceObject && module1.exports !== module1.namespaceObject) {
        // in case of a circular dependency: cjs1 -> esm2 -> cjs1
        interopEsm(module1.exports, module1.namespaceObject);
    }
    return module1;
}
/**
 * Retrieves a module from the cache, or instantiate it if it is not cached.
 */ // @ts-ignore
function getOrInstantiateModuleFromParent(id, sourceModule) {
    const module1 = moduleCache[id];
    if (module1) {
        if (module1.error) {
            throw module1.error;
        }
        return module1;
    }
    return instantiateModule(id, 1, sourceModule.id);
}
/**
 * Instantiates a runtime module.
 */ function instantiateRuntimeModule(chunkPath, moduleId) {
    return instantiateModule(moduleId, 0, chunkPath);
}
/**
 * Retrieves a module from the cache, or instantiate it as a runtime module if it is not cached.
 */ // @ts-ignore TypeScript doesn't separate this module space from the browser runtime
function getOrInstantiateRuntimeModule(chunkPath, moduleId) {
    const module1 = moduleCache[moduleId];
    if (module1) {
        if (module1.error) {
            throw module1.error;
        }
        return module1;
    }
    return instantiateRuntimeModule(chunkPath, moduleId);
}
const regexJsUrl = /\.js(?:\?[^#]*)?(?:#.*)?$/;
/**
 * Checks if a given path/URL ends with .js, optionally followed by ?query or #fragment.
 */ function isJs(chunkUrlOrPath) {
    return regexJsUrl.test(chunkUrlOrPath);
}
module.exports = (sourcePath)=>({
        m: (id)=>getOrInstantiateRuntimeModule(sourcePath, id),
        c: (chunkData)=>loadRuntimeChunk(sourcePath, chunkData)
    });


//# sourceMappingURL=%5Bturbopack%5D_runtime.js.map

  function requireChunk(chunkPath) {
    switch(chunkPath) {
      case "server/chunks/ssr/[root-of-the-server]__0b1f7dce._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__0b1f7dce._.js");
      case "server/chunks/ssr/[root-of-the-server]__4978c38b._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__4978c38b._.js");
      case "server/chunks/ssr/[root-of-the-server]__53365be1._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__53365be1._.js");
      case "server/chunks/ssr/[root-of-the-server]__7f4a755f._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__7f4a755f._.js");
      case "server/chunks/ssr/[root-of-the-server]__c75131e4._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__c75131e4._.js");
      case "server/chunks/ssr/[root-of-the-server]__c8f0d291._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__c8f0d291._.js");
      case "server/chunks/ssr/[turbopack]_runtime.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[turbopack]_runtime.js");
      case "server/chunks/ssr/_45f5b9b6._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_45f5b9b6._.js");
      case "server/chunks/ssr/_543218c3._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_543218c3._.js");
      case "server/chunks/ssr/_73dcb916._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_73dcb916._.js");
      case "server/chunks/ssr/_7b92dabc._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_7b92dabc._.js");
      case "server/chunks/ssr/_e00fe26c._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_e00fe26c._.js");
      case "server/chunks/ssr/_next-internal_server_app__not-found_page_actions_554ec2bf.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app__not-found_page_actions_554ec2bf.js");
      case "server/chunks/ssr/adf63_next_dist_970c089e._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/adf63_next_dist_970c089e._.js");
      case "server/chunks/ssr/adf63_next_dist_client_components_32132543._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/adf63_next_dist_client_components_32132543._.js");
      case "server/chunks/ssr/adf63_next_dist_client_components_builtin_forbidden_021b0b2b.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/adf63_next_dist_client_components_builtin_forbidden_021b0b2b.js");
      case "server/chunks/ssr/adf63_next_dist_esm_2f955303._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/adf63_next_dist_esm_2f955303._.js");
      case "server/chunks/ssr/adf63_next_dist_esm_build_templates_app-page_c8c42883.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/adf63_next_dist_esm_build_templates_app-page_c8c42883.js");
      case "server/chunks/ssr/app_b9b1292a._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/app_b9b1292a._.js");
      case "server/chunks/ssr/[root-of-the-server]__4f8e2204._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__4f8e2204._.js");
      case "server/chunks/ssr/[root-of-the-server]__5f581581._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__5f581581._.js");
      case "server/chunks/ssr/[root-of-the-server]__739919fa._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__739919fa._.js");
      case "server/chunks/ssr/[root-of-the-server]__d076064f._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__d076064f._.js");
      case "server/chunks/ssr/[root-of-the-server]__fd2d287f._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__fd2d287f._.js");
      case "server/chunks/ssr/_7ca4f4e0._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_7ca4f4e0._.js");
      case "server/chunks/ssr/_next-internal_server_app_(auth)_login_page_actions_bf14911e.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_(auth)_login_page_actions_bf14911e.js");
      case "server/chunks/ssr/adf63_next_dist_client_components_builtin_global-error_078ecdb8.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/adf63_next_dist_client_components_builtin_global-error_078ecdb8.js");
      case "server/chunks/ssr/adf63_next_dist_client_components_builtin_unauthorized_fbe79398.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/adf63_next_dist_client_components_builtin_unauthorized_fbe79398.js");
      case "server/chunks/ssr/c7d33_react-hook-form_dist_index_esm_mjs_fea0b5ca._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/c7d33_react-hook-form_dist_index_esm_mjs_fea0b5ca._.js");
      case "server/chunks/ssr/node_modules__pnpm_198c7974._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules__pnpm_198c7974._.js");
      case "server/chunks/ssr/node_modules__pnpm_8a46ca3c._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules__pnpm_8a46ca3c._.js");
      case "server/chunks/ssr/[root-of-the-server]__097868c3._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__097868c3._.js");
      case "server/chunks/ssr/[root-of-the-server]__8fa3fcb1._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__8fa3fcb1._.js");
      case "server/chunks/ssr/_31ca5bc3._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_31ca5bc3._.js");
      case "server/chunks/ssr/_7d4633e2._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_7d4633e2._.js");
      case "server/chunks/ssr/_b3a20628._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_b3a20628._.js");
      case "server/chunks/ssr/_next-internal_server_app_(dashboard)_dashboard_page_actions_9d14b367.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_(dashboard)_dashboard_page_actions_9d14b367.js");
      case "server/chunks/ssr/adf63_next_dist_fc18643b._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/adf63_next_dist_fc18643b._.js");
      case "server/chunks/ssr/app_(dashboard)_dashboard_page_tsx_fe23b591._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/app_(dashboard)_dashboard_page_tsx_fe23b591._.js");
      case "server/chunks/ssr/app_(dashboard)_layout_tsx_3fcfbfb4._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/app_(dashboard)_layout_tsx_3fcfbfb4._.js");
      case "server/chunks/ssr/app_(dashboard)_layout_tsx_82dc2da3._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/app_(dashboard)_layout_tsx_82dc2da3._.js");
      case "server/chunks/ssr/node_modules__pnpm_536720b2._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules__pnpm_536720b2._.js");
      case "server/chunks/ssr/50d1e_date-fns_2296ab29._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/50d1e_date-fns_2296ab29._.js");
      case "server/chunks/ssr/[root-of-the-server]__7cf07e31._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__7cf07e31._.js");
      case "server/chunks/ssr/_3de4f735._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_3de4f735._.js");
      case "server/chunks/ssr/_4d46d846._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_4d46d846._.js");
      case "server/chunks/ssr/_8ef1d792._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_8ef1d792._.js");
      case "server/chunks/ssr/_next-internal_server_app_(dashboard)_employees_[id]_page_actions_152c7b73.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_(dashboard)_employees_[id]_page_actions_152c7b73.js");
      case "server/chunks/ssr/app_(dashboard)_employees_[id]_page_tsx_b1be0a05._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/app_(dashboard)_employees_[id]_page_tsx_b1be0a05._.js");
      case "server/chunks/ssr/components_ui_select_tsx_7ab5c347._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/components_ui_select_tsx_7ab5c347._.js");
      case "server/chunks/ssr/node_modules__pnpm_5d2f3cc3._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/node_modules__pnpm_5d2f3cc3._.js");
      case "server/chunks/ssr/[root-of-the-server]__7e3d7162._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__7e3d7162._.js");
      case "server/chunks/ssr/_1ceabbfa._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_1ceabbfa._.js");
      case "server/chunks/ssr/_31ea820d._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_31ea820d._.js");
      case "server/chunks/ssr/_next-internal_server_app_(dashboard)_employees_page_actions_5646daa1.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_(dashboard)_employees_page_actions_5646daa1.js");
      case "server/chunks/ssr/[root-of-the-server]__45838938._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__45838938._.js");
      case "server/chunks/ssr/_300ee6d0._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_300ee6d0._.js");
      case "server/chunks/ssr/_6f6101da._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_6f6101da._.js");
      case "server/chunks/ssr/_d059aafa._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_d059aafa._.js");
      case "server/chunks/ssr/_next-internal_server_app_(dashboard)_request_leave_[id]_page_actions_cd4bd554.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_(dashboard)_request_leave_[id]_page_actions_cd4bd554.js");
      case "server/chunks/ssr/components_requests_LeaveRequestForm_tsx_849c3173._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/components_requests_LeaveRequestForm_tsx_849c3173._.js");
      case "server/chunks/ssr/[root-of-the-server]__14306784._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__14306784._.js");
      case "server/chunks/ssr/_6deb205e._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_6deb205e._.js");
      case "server/chunks/ssr/_831f9672._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_831f9672._.js");
      case "server/chunks/ssr/_next-internal_server_app_(dashboard)_request_leave_apply_page_actions_dd2a705c.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_(dashboard)_request_leave_apply_page_actions_dd2a705c.js");
      case "server/chunks/ssr/50d1e_date-fns_0e1e90ec._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/50d1e_date-fns_0e1e90ec._.js");
      case "server/chunks/ssr/[root-of-the-server]__40633833._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__40633833._.js");
      case "server/chunks/ssr/_a15ffda4._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_a15ffda4._.js");
      case "server/chunks/ssr/_e2cda7a3._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_e2cda7a3._.js");
      case "server/chunks/ssr/_next-internal_server_app_(dashboard)_request_leave_page_actions_c6f22335.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_(dashboard)_request_leave_page_actions_c6f22335.js");
      case "server/chunks/ssr/[root-of-the-server]__f2bab531._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__f2bab531._.js");
      case "server/chunks/ssr/_next-internal_server_app__global-error_page_actions_75761787.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app__global-error_page_actions_75761787.js");
      case "server/chunks/ssr/adf63_next_dist_5acab0a6._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/adf63_next_dist_5acab0a6._.js");
      case "server/chunks/[root-of-the-server]__4b8f1c67._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__4b8f1c67._.js");
      case "server/chunks/[root-of-the-server]__75d064d9._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__75d064d9._.js");
      case "server/chunks/[turbopack]_runtime.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[turbopack]_runtime.js");
      case "server/chunks/_next-internal_server_app_api_announcements_route_actions_d83e3901.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_announcements_route_actions_d83e3901.js");
      case "server/chunks/[root-of-the-server]__1f732b87._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__1f732b87._.js");
      case "server/chunks/_next-internal_server_app_api_approval_[status]_route_actions_aea31631.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_approval_[status]_route_actions_aea31631.js");
      case "server/chunks/[root-of-the-server]__58c76793._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__58c76793._.js");
      case "server/chunks/_next-internal_server_app_api_approval_reason_route_actions_0723962c.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_approval_reason_route_actions_0723962c.js");
      case "server/chunks/[root-of-the-server]__e2599555._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__e2599555._.js");
      case "server/chunks/_next-internal_server_app_api_approval_route_actions_a418a71c.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_approval_route_actions_a418a71c.js");
      case "server/chunks/[root-of-the-server]__4d4bc039._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__4d4bc039._.js");
      case "server/chunks/_next-internal_server_app_api_attendance_clock_route_actions_af28fb0b.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_attendance_clock_route_actions_af28fb0b.js");
      case "server/chunks/lib_services_attendance_service_ts_f82726fb._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/lib_services_attendance_service_ts_f82726fb._.js");
      case "server/chunks/[root-of-the-server]__b59a1005._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__b59a1005._.js");
      case "server/chunks/_next-internal_server_app_api_auth_login_route_actions_d02a8f19.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_login_route_actions_d02a8f19.js");
      case "server/chunks/[root-of-the-server]__5b664fb7._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__5b664fb7._.js");
      case "server/chunks/_next-internal_server_app_api_auth_logout_route_actions_5aa6c6ca.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_logout_route_actions_5aa6c6ca.js");
      case "server/chunks/[root-of-the-server]__873bf87d._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__873bf87d._.js");
      case "server/chunks/_next-internal_server_app_api_auth_refresh_route_actions_eaf775f4.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_refresh_route_actions_eaf775f4.js");
      case "server/chunks/[root-of-the-server]__3d5bc5c1._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__3d5bc5c1._.js");
      case "server/chunks/_next-internal_server_app_api_auth_validate-session_route_actions_fc637d67.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_auth_validate-session_route_actions_fc637d67.js");
      case "server/chunks/[root-of-the-server]__db9ebaad._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__db9ebaad._.js");
      case "server/chunks/[root-of-the-server]__ff8f478b._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__ff8f478b._.js");
      case "server/chunks/_next-internal_server_app_api_biolog_route_actions_6c17e1a7.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_biolog_route_actions_6c17e1a7.js");
      case "server/chunks/[root-of-the-server]__4ea847f8._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__4ea847f8._.js");
      case "server/chunks/_next-internal_server_app_api_biolog_team_route_actions_01877f79.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_biolog_team_route_actions_01877f79.js");
      case "server/chunks/[root-of-the-server]__50f24da7._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__50f24da7._.js");
      case "server/chunks/_054a948b._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_054a948b._.js");
      case "server/chunks/_next-internal_server_app_api_coa_[coa_sid]_route_actions_1ca537fc.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_coa_[coa_sid]_route_actions_1ca537fc.js");
      case "server/chunks/[root-of-the-server]__4dd5fef0._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__4dd5fef0._.js");
      case "server/chunks/_next-internal_server_app_api_coa_coatype_route_actions_f3888a7a.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_coa_coatype_route_actions_f3888a7a.js");
      case "server/chunks/[root-of-the-server]__0af589ba._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__0af589ba._.js");
      case "server/chunks/_next-internal_server_app_api_coa_forapproval_[coa_sid]_route_actions_87cb2466.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_coa_forapproval_[coa_sid]_route_actions_87cb2466.js");
      case "server/chunks/_a9e0bf2d._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_a9e0bf2d._.js");
      case "server/chunks/_next-internal_server_app_api_coa_route_actions_1321aa4c.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_coa_route_actions_1321aa4c.js");
      case "server/chunks/[root-of-the-server]__d9b5472f._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__d9b5472f._.js");
      case "server/chunks/_next-internal_server_app_api_employee_[id]_advances_route_actions_2fc8a20c.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_[id]_advances_route_actions_2fc8a20c.js");
      case "server/chunks/[root-of-the-server]__ff5837e8._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__ff5837e8._.js");
      case "server/chunks/ce889_server_app_api_employee_[id]_benefits-leaves_route_actions_1759963d.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ce889_server_app_api_employee_[id]_benefits-leaves_route_actions_1759963d.js");
      case "server/chunks/[root-of-the-server]__2ea3c7a2._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__2ea3c7a2._.js");
      case "server/chunks/[root-of-the-server]__daf075c9._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__daf075c9._.js");
      case "server/chunks/_next-internal_server_app_api_employee_[id]_route_actions_ca9cbe3b.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_[id]_route_actions_ca9cbe3b.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_fe0e5af9.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_fe0e5af9.js");
      case "server/chunks/lib_storage_index_ts_b9b03e50._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/lib_storage_index_ts_b9b03e50._.js");
      case "server/chunks/[root-of-the-server]__873a5225._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__873a5225._.js");
      case "server/chunks/_next-internal_server_app_api_employee_[id]_salary_route_actions_d1a258d0.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_[id]_salary_route_actions_d1a258d0.js");
      case "server/chunks/[root-of-the-server]__ecfd702e._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__ecfd702e._.js");
      case "server/chunks/_next-internal_server_app_api_employee_[id]_schedule_route_actions_3e3d8259.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_[id]_schedule_route_actions_3e3d8259.js");
      case "server/chunks/[root-of-the-server]__d0d5e7b5._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__d0d5e7b5._.js");
      case "server/chunks/_next-internal_server_app_api_employee_[id]_security_route_actions_46bde4fd.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_[id]_security_route_actions_46bde4fd.js");
      case "server/chunks/[root-of-the-server]__831680fc._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__831680fc._.js");
      case "server/chunks/_next-internal_server_app_api_employee_[id]_work_route_actions_e7125825.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_[id]_work_route_actions_e7125825.js");
      case "server/chunks/[root-of-the-server]__4a47492c._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__4a47492c._.js");
      case "server/chunks/_next-internal_server_app_api_employee_departments_route_actions_fac961c1.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_departments_route_actions_fac961c1.js");
      case "server/chunks/[root-of-the-server]__f804cf20._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__f804cf20._.js");
      case "server/chunks/_next-internal_server_app_api_employee_list_all_route_actions_733f5c02.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_list_all_route_actions_733f5c02.js");
      case "server/chunks/[root-of-the-server]__4a3a0230._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__4a3a0230._.js");
      case "server/chunks/_next-internal_server_app_api_employee_locations_route_actions_59e8b43b.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_locations_route_actions_59e8b43b.js");
      case "server/chunks/[root-of-the-server]__40acbf4e._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__40acbf4e._.js");
      case "server/chunks/_next-internal_server_app_api_employee_positions_route_actions_815f3075.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_positions_route_actions_815f3075.js");
      case "server/chunks/[root-of-the-server]__a289b433._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__a289b433._.js");
      case "server/chunks/_next-internal_server_app_api_employee_route_actions_885d56d7.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_route_actions_885d56d7.js");
      case "server/chunks/[root-of-the-server]__a90c9999._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__a90c9999._.js");
      case "server/chunks/_next-internal_server_app_api_employee_status_[id]_route_actions_f77c49c4.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_employee_status_[id]_route_actions_f77c49c4.js");
      case "server/chunks/_next-internal_server_app_api_leave_create_summary_[id]_route_actions_a0e79a37.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_leave_create_summary_[id]_route_actions_a0e79a37.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_c91b1784.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_c91b1784.js");
      case "server/chunks/[root-of-the-server]__546f5fa8._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__546f5fa8._.js");
      case "server/chunks/_next-internal_server_app_api_leave_credit_[id]_route_actions_7bbde291.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_leave_credit_[id]_route_actions_7bbde291.js");
      case "server/chunks/_next-internal_server_app_api_leave_edit_summary_[id]_route_actions_3a364708.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_leave_edit_summary_[id]_route_actions_3a364708.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_8b90207c.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_8b90207c.js");
      case "server/chunks/[root-of-the-server]__842552c6._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__842552c6._.js");
      case "server/chunks/_next-internal_server_app_api_leave_forapproval_[id]_route_actions_be680266.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_leave_forapproval_[id]_route_actions_be680266.js");
      case "server/chunks/_next-internal_server_app_api_leave_grid_route_actions_8e92a9ba.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_leave_grid_route_actions_8e92a9ba.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_f909975e.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_f909975e.js");
      case "server/chunks/[root-of-the-server]__57e634df._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__57e634df._.js");
      case "server/chunks/_next-internal_server_app_api_leave_list_summary_[id]_route_actions_69aaeede.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_leave_list_summary_[id]_route_actions_69aaeede.js");
      case "server/chunks/[root-of-the-server]__d2f14805._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__d2f14805._.js");
      case "server/chunks/_next-internal_server_app_api_leave_types_route_actions_79f29134.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_leave_types_route_actions_79f29134.js");
      case "server/chunks/[root-of-the-server]__cddf1d4a._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__cddf1d4a._.js");
      case "server/chunks/_next-internal_server_app_api_leave_user_[id]_route_actions_30e651e6.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_leave_user_[id]_route_actions_30e651e6.js");
      case "server/chunks/_next-internal_server_app_api_leave_user_delete_[id]_route_actions_a3d94a8d.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_leave_user_delete_[id]_route_actions_a3d94a8d.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_710036fc.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_710036fc.js");
      case "server/chunks/_next-internal_server_app_api_leave_year_route_actions_02409a45.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_leave_year_route_actions_02409a45.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_6d4defe6.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_6d4defe6.js");
      case "server/chunks/_next-internal_server_app_api_loan_[id]_route_actions_e50db56c.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_loan_[id]_route_actions_e50db56c.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_5d8e334b.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_5d8e334b.js");
      case "server/chunks/_next-internal_server_app_api_loan_manage_route_actions_1ec786d7.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_loan_manage_route_actions_1ec786d7.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_8032bb78.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_8032bb78.js");
      case "server/chunks/_next-internal_server_app_api_loan_route_actions_22e144c0.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_loan_route_actions_22e144c0.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_87aa0799.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_87aa0799.js");
      case "server/chunks/[root-of-the-server]__900292e4._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__900292e4._.js");
      case "server/chunks/_next-internal_server_app_api_menu_company_route_actions_1b6c3b19.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_menu_company_route_actions_1b6c3b19.js");
      case "server/chunks/[root-of-the-server]__547cc4fd._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__547cc4fd._.js");
      case "server/chunks/_next-internal_server_app_api_menu_list_route_actions_06f9ee27.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_menu_list_route_actions_06f9ee27.js");
      case "server/chunks/_next-internal_server_app_api_overtime_[id]_route_actions_37cda2f7.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_overtime_[id]_route_actions_37cda2f7.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_d2dc7130.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_d2dc7130.js");
      case "server/chunks/[root-of-the-server]__fca128db._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__fca128db._.js");
      case "server/chunks/_next-internal_server_app_api_overtime_attendance_[date]_route_actions_6b9ba1bc.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_overtime_attendance_[date]_route_actions_6b9ba1bc.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_c538e39f.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_c538e39f.js");
      case "server/chunks/ce889_server_app_api_overtime_byid_[userid]_[otid]_route_actions_6d4fb621.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ce889_server_app_api_overtime_byid_[userid]_[otid]_route_actions_6d4fb621.js");
      case "server/chunks/_next-internal_server_app_api_overtime_cancel_[id]_route_actions_4870b0c0.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_overtime_cancel_[id]_route_actions_4870b0c0.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_d5cd705c.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_d5cd705c.js");
      case "server/chunks/[root-of-the-server]__fa942d22._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__fa942d22._.js");
      case "server/chunks/_next-internal_server_app_api_overtime_forapproval_[otid]_route_actions_cb2fbea6.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_overtime_forapproval_[otid]_route_actions_cb2fbea6.js");
      case "server/chunks/_next-internal_server_app_api_overtime_list_route_actions_d2193cf8.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_overtime_list_route_actions_d2193cf8.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_bff6bc91.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_bff6bc91.js");
      case "server/chunks/_next-internal_server_app_api_overtime_route_actions_494e76a7.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_overtime_route_actions_494e76a7.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_d175643c.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_d175643c.js");
      case "server/chunks/_next-internal_server_app_api_overtime_year_route_actions_3896ac66.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_overtime_year_route_actions_3896ac66.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_ce21362d.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_ce21362d.js");
      case "server/chunks/[root-of-the-server]__f576a607._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__f576a607._.js");
      case "server/chunks/_next-internal_server_app_api_payroll_comded_route_actions_4f706bef.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_payroll_comded_route_actions_4f706bef.js");
      case "server/chunks/[root-of-the-server]__0c6c1bd5._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__0c6c1bd5._.js");
      case "server/chunks/_next-internal_server_app_api_requests_stats_route_actions_02d81380.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_requests_stats_route_actions_02d81380.js");
      case "server/chunks/[root-of-the-server]__06a518db._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__06a518db._.js");
      case "server/chunks/_next-internal_server_app_api_roles_route_actions_955317e8.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_roles_route_actions_955317e8.js");
      case "server/chunks/_next-internal_server_app_api_schedule-adjust_cancel_[id]_route_actions_8e8ae241.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_schedule-adjust_cancel_[id]_route_actions_8e8ae241.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_930a5d29.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_930a5d29.js");
      case "server/chunks/_next-internal_server_app_api_schedule-adjust_create_route_actions_ae383c8e.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_schedule-adjust_create_route_actions_ae383c8e.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_bea3dc92.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_bea3dc92.js");
      case "server/chunks/_next-internal_server_app_api_schedule-adjust_edit_[id]_route_actions_f2ed2035.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_schedule-adjust_edit_[id]_route_actions_f2ed2035.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_ed114b6b.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_ed114b6b.js");
      case "server/chunks/[root-of-the-server]__d8ca6e2b._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__d8ca6e2b._.js");
      case "server/chunks/ce889_server_app_api_schedule-adjust_forapproval_[id]_route_actions_87e97791.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ce889_server_app_api_schedule-adjust_forapproval_[id]_route_actions_87e97791.js");
      case "server/chunks/[root-of-the-server]__2edaf2ef._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__2edaf2ef._.js");
      case "server/chunks/_next-internal_server_app_api_schedule-adjust_id_[id]_route_actions_8a865809.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_schedule-adjust_id_[id]_route_actions_8a865809.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_fcd71ff7.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_fcd71ff7.js");
      case "server/chunks/ce889_server_app_api_schedule-adjust_schedadjusted_route_actions_0b62da24.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ce889_server_app_api_schedule-adjust_schedadjusted_route_actions_0b62da24.js");
      case "server/chunks/_next-internal_server_app_api_schedule-adjust_year_route_actions_de7a1a11.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_schedule-adjust_year_route_actions_de7a1a11.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_958c4fd1.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_958c4fd1.js");
      case "server/chunks/[root-of-the-server]__bfd7ee6b._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__bfd7ee6b._.js");
      case "server/chunks/_next-internal_server_app_api_settings_company_route_actions_bc43fff3.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_settings_company_route_actions_bc43fff3.js");
      case "server/chunks/[root-of-the-server]__a9df65d4._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__a9df65d4._.js");
      case "server/chunks/_next-internal_server_app_api_settings_route_actions_a476013b.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_settings_route_actions_a476013b.js");
      case "server/chunks/[root-of-the-server]__0e153fe7._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__0e153fe7._.js");
      case "server/chunks/_next-internal_server_app_api_status_route_actions_d551bce0.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_status_route_actions_d551bce0.js");
      case "server/chunks/lib_services_status_service_ts_dac33fb9._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/lib_services_status_service_ts_dac33fb9._.js");
      case "server/chunks/_next-internal_server_app_api_undertime_cancel_[id]_route_actions_ca74bf3c.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_undertime_cancel_[id]_route_actions_ca74bf3c.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_5de8f035.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_5de8f035.js");
      case "server/chunks/_1287a255._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_1287a255._.js");
      case "server/chunks/_next-internal_server_app_api_undertime_create_[id]_route_actions_d1e87a50.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_undertime_create_[id]_route_actions_d1e87a50.js");
      case "server/chunks/_next-internal_server_app_api_undertime_edit_[id]_route_actions_b611f00e.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_undertime_edit_[id]_route_actions_b611f00e.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_2c797cc7.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_2c797cc7.js");
      case "server/chunks/[root-of-the-server]__965d60a3._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__965d60a3._.js");
      case "server/chunks/_next-internal_server_app_api_undertime_forapproval_[id]_route_actions_cfce1fbc.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_undertime_forapproval_[id]_route_actions_cfce1fbc.js");
      case "server/chunks/[root-of-the-server]__1174a125._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__1174a125._.js");
      case "server/chunks/_next-internal_server_app_api_undertime_id_[id]_route_actions_679d0da9.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_undertime_id_[id]_route_actions_679d0da9.js");
      case "server/chunks/[root-of-the-server]__9d87ebf4._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__9d87ebf4._.js");
      case "server/chunks/_next-internal_server_app_api_upload_[path]_[fk]_[type]_route_actions_e3aab61a.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_upload_[path]_[fk]_[type]_route_actions_e3aab61a.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_6ba4308f.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_6ba4308f.js");
      case "server/chunks/[root-of-the-server]__58db4f04._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__58db4f04._.js");
      case "server/chunks/_next-internal_server_app_api_upload_file_[id]_route_actions_7ca2634a.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_upload_file_[id]_route_actions_7ca2634a.js");
      case "server/chunks/[root-of-the-server]__05ecc0b4._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[root-of-the-server]__05ecc0b4._.js");
      case "server/chunks/_next-internal_server_app_api_user-profile_route_actions_4f8d7c44.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_api_user-profile_route_actions_4f8d7c44.js");
      case "server/chunks/[externals]_next_dist_b01ab6e1._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/[externals]_next_dist_b01ab6e1._.js");
      case "server/chunks/_next-internal_server_app_favicon_ico_route_actions_353150a5.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/_next-internal_server_app_favicon_ico_route_actions_353150a5.js");
      case "server/chunks/adf63_next_dist_esm_build_templates_app-route_67d5b2f6.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/adf63_next_dist_esm_build_templates_app-route_67d5b2f6.js");
      case "server/chunks/ssr/[root-of-the-server]__62316f1c._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__62316f1c._.js");
      case "server/chunks/ssr/[root-of-the-server]__d9cb1aef._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/[root-of-the-server]__d9cb1aef._.js");
      case "server/chunks/ssr/_9f5fa743._.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_9f5fa743._.js");
      case "server/chunks/ssr/_next-internal_server_app_page_actions_39d4fc33.js": return require("/Users/brentsoler/Developer/projects/hriz/HRIS_API_Next/.open-next/server-functions/default/.next/server/chunks/ssr/_next-internal_server_app_page_actions_39d4fc33.js");
      default:
        throw new Error(`Not found ${chunkPath}`);
    }
  }
