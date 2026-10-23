// ==UserScript==
// @name         Every facility — PCC Core (tiles & gather)
// @version      2.10.18
// @description  The consolidated tile system: gatherer + dashboard + tiles + psychiatry in ONE script. One resident identity (the kernel), one boot ladder, one record. Replaces the separate Gatherer, Dashboard, More/Less and Psychiatry tab scripts.
// @downloadURL  https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Core.user.js
// @updateURL    https://raw.githubusercontent.com/adrianb-tech/pcc-scripts/main/PCC-All-Core.user.js
// @match        https://*.pointclickcare.com/*
// @match        https://*.pointclickcare.ca/*
// @run-at       document-idle
// ==/UserScript==

(function() {
	"use strict";
	function getEnumValues(entries) {
		const numericValues = Object.values(entries).filter((v) => typeof v === "number");
		return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
	}
	function joinValues(array, separator = "|") {
		return array.map((val) => stringifyPrimitive(val)).join(separator);
	}
	function jsonStringifyReplacer(_, value) {
		if (typeof value === "bigint") return value.toString();
		return value;
	}
	var Cached = class {
		constructor(getter) {
			this._getter = getter;
			this._value = void 0;
		}
		get value() {
			const getter = this._getter;
			if (getter !== void 0) {
				this._value = getter();
				this._getter = void 0;
			}
			return this._value;
		}
	};
	function cached(getter) {
		return new Cached(getter);
	}
	function nullish(input) {
		return input === null || input === void 0;
	}
	function cleanRegex(source) {
		const start = source.startsWith("^") ? 1 : 0;
		const end = source.endsWith("$") ? source.length - 1 : source.length;
		return source.slice(start, end);
	}
	function floatSafeRemainder(val, step) {
		const ratio = val / step;
		const roundedRatio = Math.round(ratio);
		const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
		if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
		return ratio - roundedRatio;
	}
	function assignProp(target, prop, value) {
		Object.defineProperty(target, prop, {
			value,
			writable: true,
			enumerable: true,
			configurable: true
		});
	}
	function rawShape(def) {
		const desc = Object.getOwnPropertyDescriptor(def, "shape");
		return desc?.get ? desc.get.raw : desc?.value;
	}
	function sourceShape(schema) {
		return rawShape(schema._zod.def) ?? schema._zod.def.shape;
	}
	function deferProp(target, key, getter) {
		Object.defineProperty(target, key, {
			get() {
				const value = getter();
				assignProp(this, key, value);
				return value;
			},
			enumerable: true,
			configurable: true
		});
	}
	function putProp(target, key, value) {
		if (key in target) assignProp(target, key, value);
		else target[key] = value;
	}
	function mirrorShape(target, source, keys, wrap) {
		const raw = sourceShape(source);
		for (const key of keys) {
			const desc = Object.getOwnPropertyDescriptor(raw, key);
			if (!desc.enumerable) continue;
			if (desc.get) deferProp(target, key, () => {
				const value = source._zod.def.shape[key];
				return wrap ? wrap(value, key) : value;
			});
			else putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
		}
	}
	function mirrorProps(target, source) {
		for (const key of Reflect.ownKeys(source)) {
			const desc = Object.getOwnPropertyDescriptor(source, key);
			if (!desc.enumerable) continue;
			if (desc.get) deferProp(target, key, () => source[key]);
			else putProp(target, key, desc.value);
		}
	}
	function mergeDefs(...defs) {
		const mergedDescriptors = {};
		for (const def of defs) {
			const descriptors = Object.getOwnPropertyDescriptors(def);
			Object.assign(mergedDescriptors, descriptors);
		}
		return Object.defineProperties({}, mergedDescriptors);
	}
	function esc(str) {
		return JSON.stringify(str);
	}
	function slugify(input) {
		return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
	}
	var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
	function isObject(data) {
		return typeof data === "object" && data !== null && !Array.isArray(data);
	}
	var allowsEval = cached(() => {
		if (globalConfig.jitless) return false;
		if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
		try {
			new Function("");
			return true;
		} catch (_) {
			return false;
		}
	});
	function isPlainObject(o) {
		if (isObject(o) === false) return false;
		const ctor = o.constructor;
		if (ctor === void 0) return true;
		if (typeof ctor !== "function") return true;
		const prot = ctor.prototype;
		if (isObject(prot) === false) return false;
		if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
		return true;
	}
	function shallowClone(o) {
		if (isPlainObject(o)) return { ...o };
		if (Array.isArray(o)) return [...o];
		if (o instanceof Map) return new Map(o);
		if (o instanceof Set) return new Set(o);
		return o;
	}
	var propertyKeyTypes = new Set([
		"string",
		"number",
		"symbol"
	]);
	function escapeRegex(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
	function clone(inst, def, params) {
		const cl = new inst._zod.constr(def ?? inst._zod.def);
		if (!def || params?.parent) cl._zod.parent = inst;
		return cl;
	}
	function normalizeParams(_params) {
		const params = _params;
		if (!params) return {};
		if (typeof params === "string") return { error: () => params };
		if (params?.message !== void 0) {
			if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
			params.error = params.message;
		}
		delete params.message;
		if (typeof params.error === "string") return {
			...params,
			error: () => params.error
		};
		return params;
	}
	function stringifyPrimitive(value) {
		if (typeof value === "bigint") return value.toString() + "n";
		if (typeof value === "string") return `"${value}"`;
		return `${value}`;
	}
	function optionalKeys(shape) {
		return Object.keys(shape).filter((k) => {
			return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
		});
	}
	var NUMBER_FORMAT_RANGES = (() => ({
		safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
		int32: [-2147483648, 2147483647],
		uint32: [0, 4294967295],
		float32: [-34028234663852886e22, 34028234663852886e22],
		float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
	}))();
	var BIGINT_FORMAT_RANGES = {
		int64: [BigInt("-9223372036854775808"), BigInt("9223372036854775807")],
		uint64: [BigInt(0), BigInt("18446744073709551615")]
	};
	function pick(schema, mask) {
		const currDef = schema._zod.def;
		const checks = currDef.checks;
		if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
		const newShape = {};
		mirrorShape(newShape, schema, maskedKeys(schema, mask));
		return clone(schema, mergeDefs(currDef, {
			shape: newShape,
			checks: []
		}));
	}
	function maskedKeys(schema, mask) {
		const raw = sourceShape(schema);
		const keys = [];
		for (const key of Reflect.ownKeys(mask)) {
			if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) throw new Error(`Unrecognized key: "${String(key)}"`);
			if (mask[key]) keys.push(key);
		}
		return keys;
	}
	function omit(schema, mask) {
		const currDef = schema._zod.def;
		const checks = currDef.checks;
		if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
		const omitted = new Set(maskedKeys(schema, mask));
		const newShape = {};
		mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
		return clone(schema, mergeDefs(currDef, {
			shape: newShape,
			checks: []
		}));
	}
	function extend(schema, shape) {
		if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
		const checks = schema._zod.def.checks;
		if (checks && checks.length > 0) {
			const existingShape = sourceShape(schema);
			for (const key of Reflect.ownKeys(shape)) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
		}
		return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
	}
	function extended(schema, shape) {
		const newShape = {};
		mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
		mirrorProps(newShape, shape);
		return newShape;
	}
	function safeExtend(schema, shape) {
		if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
		return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
	}
	function merge(a, b) {
		if (!b?._zod?.def) throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
		if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
		const newShape = {};
		mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
		mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
		return clone(a, mergeDefs(a._zod.def, {
			shape: newShape,
			get catchall() {
				return b._zod.def.catchall;
			},
			checks: b._zod.def.checks ?? []
		}));
	}
	function partial(Class, schema, mask, name = "partial") {
		const checks = schema._zod.def.checks;
		if (checks && checks.length > 0) throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
		const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
		const newShape = {};
		mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class && ((value, key) => selected && !selected.has(key) ? value : new Class({
			type: "optional",
			innerType: value
		})));
		return clone(schema, mergeDefs(schema._zod.def, {
			shape: newShape,
			checks: []
		}));
	}
	function required(Class, schema, mask) {
		const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
		const newShape = {};
		mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => selected && !selected.has(key) ? value : new Class({
			type: "nonoptional",
			innerType: value
		}));
		return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
	}
	function aborted(x, startIndex = 0) {
		if (x.aborted === true) return true;
		for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
		return false;
	}
	function explicitlyAborted(x, startIndex = 0) {
		if (x.aborted === true) return true;
		for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
		return false;
	}
	function prefixIssues(path, issues) {
		return issues.map((iss) => {
			var _a;
			(_a = iss).path ?? (_a.path = []);
			iss.path.unshift(path);
			return iss;
		});
	}
	function unwrapMessage(message) {
		return typeof message === "string" ? message : message?.message;
	}
	function sizeCaps(defChecks) {
		const caps = [];
		for (const ch of defChecks ?? []) {
			const d = ch._zod.def;
			if (!/_(length|size)$|_equals$/.test(d.check)) break;
			const max = d.maximum ?? d.length ?? d.size;
			if (max >= 0) caps.push([max, ch]);
		}
		return caps;
	}
	function attachSchema(issues, start, inst) {
		var _a;
		for (let i = start; i < issues.length; i++) (_a = issues[i]).schema ?? (_a.schema = inst);
	}
	function finalizeIssue(iss, ctx, config) {
		var _a;
		const traits = iss.inst?._zod?.traits;
		if (traits?.has("$ZodType")) {
			if (traits.has("$ZodCheck")) (_a = iss).schema ?? (_a.schema = iss.inst);
			else iss.schema = iss.inst;
		}
		const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
		const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
		const full = {};
		for (const k of Object.keys(iss)) {
			if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__") continue;
			full[k] = iss[k];
		}
		full.path ?? (full.path = []);
		full.message = message;
		if (ctx?.reportInput) full.input = iss.input;
		return full;
	}
	var highSurrogate = /[\uD800-\uDBFF]/;
	function codePointLength(str) {
		const units = str.length;
		if (!highSurrogate.test(str)) return units;
		let count = units;
		for (let i = 0; i < units - 1; i++) if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
			count--;
			i++;
		}
		return count;
	}
	function getLengthableOrigin(input) {
		if (Array.isArray(input)) return "array";
		if (typeof input === "string") return "string";
		return "unknown";
	}
	function parsedType(data) {
		const t = typeof data;
		switch (t) {
			case "number": return Number.isNaN(data) ? "nan" : "number";
			case "object": {
				if (data === null) return "null";
				if (Array.isArray(data)) return "array";
				const obj = data;
				if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) return obj.constructor.name;
			}
		}
		return t;
	}
	function issue(...args) {
		const [iss, input, inst] = args;
		if (typeof iss === "string") return {
			message: iss,
			code: "custom",
			input,
			inst
		};
		return { ...iss };
	}
	function members(proto, table) {
		for (const key in table) {
			const desc = Object.getOwnPropertyDescriptor(table, key);
			if (desc.get) Object.defineProperty(proto, key, {
				...desc,
				enumerable: false
			});
			else defineBound(proto, key, desc.value);
		}
	}
	function own(inst, key, value, enumerable = true) {
		Object.defineProperty(inst, key, {
			configurable: true,
			writable: true,
			enumerable,
			value
		});
		return value;
	}
	function hide(inst, key, value) {
		return own(inst, key, value, false);
	}
	function derived(computes, table) {
		for (const key in computes) {
			const compute = computes[key];
			Object.defineProperty(table, key, {
				configurable: true,
				enumerable: true,
				get() {
					return own(this, key, compute(this));
				},
				set(value) {
					own(this, key, value);
				}
			});
		}
		return table;
	}
	function defineBound(proto, key, fn) {
		Object.defineProperty(proto, key, {
			configurable: true,
			get() {
				return this == null ? fn : own(this, key, fn.bind(this));
			},
			set(value) {
				own(this, key, value);
			}
		});
	}
	function claim(inst, sentinel) {
		const proto = Object.getPrototypeOf(inst);
		return sentinel in proto ? void 0 : proto;
	}
	var installing;
	var broke = false;
	var breaker = {
		configurable: true,
		get() {
			broke = true;
		}
	};
	function defineLazyInternal(inst, key, compute) {
		const proto = Object.getPrototypeOf(inst._zod);
		if (key in proto && installing !== inst._zod) {
			installing = void 0;
			return;
		}
		installing = inst._zod;
		Object.defineProperty(proto, key, {
			configurable: true,
			get() {
				Object.defineProperty(this, key, breaker);
				const outer = broke;
				broke = false;
				try {
					const value = compute(this);
					if (broke) delete this[key];
					else Object.defineProperty(this, key, {
						configurable: true,
						writable: true,
						value
					});
					broke = broke || outer;
					return value;
				} catch (err) {
					delete this[key];
					broke = broke || outer;
					throw err;
				}
			},
			set(value) {
				Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					value
				});
			}
		});
	}
	function installLazyProp(inst, key, make, enumerable) {
		const proto = claim(inst, key);
		if (!proto) return;
		Object.defineProperty(proto, key, {
			configurable: true,
			get() {
				const desc = {
					configurable: true,
					writable: true,
					enumerable,
					value: void 0
				};
				Object.defineProperty(this, key, desc);
				desc.value = make(this);
				Object.defineProperty(this, key, desc);
				return desc.value;
			},
			set(value) {
				Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					enumerable,
					value
				});
			}
		});
	}
	var CONSTANT_CATCH = "~constantCatch";
	function constantCatch(value) {
		const fn = () => value;
		fn[CONSTANT_CATCH] = true;
		return fn;
	}
	var _a$1;
	var _zodDesc = {
		value: void 0,
		enumerable: false
	};
	var _E = "captureStackTrace" in Error ? Error : null;
	function newError(Definition) {
		const E = _E;
		if (E) {
			const saved = E.stackTraceLimit;
			if (typeof saved === "number") {
				try {
					E.stackTraceLimit = 0;
				} catch {
					_E = null;
					return new Definition();
				}
				try {
					return new Definition();
				} finally {
					E.stackTraceLimit = saved;
				}
			}
		}
		return new Definition();
	}
	function $constructor(name, initializer, proto, params) {
		const zodProto = {};
		function Internals(def) {
			this.def = def;
			this.constr = _;
			this.traits = new Set();
		}
		Internals.prototype = zodProto;
		const protoMembers = proto;
		const initialized = protoMembers && new WeakSet();
		function init(inst, def) {
			if (!inst._zod) {
				_zodDesc.value = new Internals(def);
				try {
					Object.defineProperty(inst, "_zod", _zodDesc);
				} finally {
					_zodDesc.value = void 0;
				}
			} else if (inst._zod.traits.has(name)) return;
			inst._zod.traits.add(name);
			initializer(inst, def);
			if (initialized) {
				const own = Object.getPrototypeOf(inst);
				const ctorProto = inst._zod.constr.prototype;
				let up = own;
				while (up && up !== ctorProto) up = Object.getPrototypeOf(up);
				const target = up ?? own;
				if (!initialized.has(target)) {
					initialized.add(target);
					members(target, protoMembers);
				}
			}
			const proto = _.prototype;
			for (const k in proto) {
				if (!Object.prototype.hasOwnProperty.call(proto, k)) continue;
				if (!(k in inst)) inst[k] = proto[k].bind(inst);
			}
		}
		const Parent = params?.Parent ?? Object;
		class Definition extends Parent {}
		Object.defineProperty(Definition, "name", { value: name });
		function _(def) {
			const inst = params?.Parent ? newError(Definition) : this;
			init(inst, def);
			const deferred = inst._zod.deferred;
			if (deferred) {
				for (const fn of deferred) fn();
				inst._zod.deferred = void 0;
			}
			const pp = globalThis.__zod_globalConfig?.postProcessor;
			if (pp) pp(inst);
			return inst;
		}
		Object.defineProperty(_, "init", { value: init });
		Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
			if (params?.Parent && inst instanceof params.Parent) return true;
			return inst?._zod?.traits?.has(name);
		} });
		Object.defineProperty(_, "name", { value: name });
		return _;
	}
	var $ZodAsyncError = class extends Error {
		constructor() {
			super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
		}
	};
	var $ZodEncodeError = class extends Error {
		constructor(name) {
			super(`Encountered unidirectional transform during encode: ${name}`);
			this.name = "ZodEncodeError";
		}
	};
	(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
	var globalConfig = globalThis.__zod_globalConfig;
	function config(newConfig) {
		if (newConfig) Object.assign(globalConfig, newConfig);
		return globalConfig;
	}
	function _getMessage() {
		const internals = this._zod;
		internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
		return internals.message;
	}
	function _setMessage(value) {
		this._zod.message = value;
	}
	var _messageDesc = {
		get: _getMessage,
		set: _setMessage,
		enumerable: true,
		configurable: true
	};
	var _issuesDesc = {
		value: void 0,
		enumerable: false
	};
	var _installedToString = new WeakSet([Object.prototype, Error.prototype]);
	var initializer$1 = (inst, def) => {
		inst.name = "$ZodError";
		_issuesDesc.value = def;
		Object.defineProperty(inst, "issues", _issuesDesc);
		_issuesDesc.value = void 0;
		Object.defineProperty(inst, "message", _messageDesc);
		const proto = Object.getPrototypeOf(inst);
		if (!_installedToString.has(proto)) {
			_installedToString.add(proto);
			Object.defineProperty(proto, "toString", {
				configurable: true,
				enumerable: false,
				get() {
					const value = () => this.message;
					Object.defineProperty(this, "toString", {
						value,
						configurable: true,
						writable: true
					});
					return value;
				},
				set(value) {
					Object.defineProperty(this, "toString", {
						value,
						configurable: true,
						writable: true
					});
				}
			});
		}
	};
	var $ZodError = $constructor("$ZodError", initializer$1);
	function node(obj, key, make) {
		if (!Object.prototype.hasOwnProperty.call(obj, key)) {
			if (key === "__proto__") Object.defineProperty(obj, key, {
				value: make(),
				writable: true,
				enumerable: true,
				configurable: true
			});
			else obj[key] = make();
		}
		return obj[key];
	}
	function flattenError(error, mapper = (issue) => issue.message) {
		const fieldErrors = {};
		const formErrors = [];
		for (const sub of error.issues) if (sub.path.length > 0) node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
		else formErrors.push(mapper(sub));
		return {
			formErrors,
			fieldErrors
		};
	}
	function formatError(error, mapper = (issue) => issue.message) {
		const fieldErrors = { _errors: [] };
		const processError = (error, path = []) => {
			for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
			else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
			else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
			else {
				const fullpath = [...path, ...issue.path];
				if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
				else {
					let curr = fieldErrors;
					let i = 0;
					while (i < fullpath.length) {
						const el = fullpath[i];
						const terminal = i === fullpath.length - 1;
						if (el === "_errors") {
							if (terminal) curr._errors.push(mapper(issue));
							i++;
							continue;
						}
						if (!Object.prototype.hasOwnProperty.call(curr, el)) Object.defineProperty(curr, el, {
							value: { _errors: [] },
							enumerable: true,
							writable: true,
							configurable: true
						});
						const node = curr[el];
						if (terminal) node._errors.push(mapper(issue));
						curr = node;
						i++;
					}
				}
			}
		};
		processError(error);
		return fieldErrors;
	}
	function finalizeParams(callee, params) {
		return {
			callee: params?.callee ?? callee,
			Err: params?.Err
		};
	}
	var _parse = (_Err) => {
		const fn = (schema, value, _ctx, _params) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			if (result.issues.length) {
				const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
				captureStackTrace(e, _params?.callee ?? fn);
				throw e;
			}
			return result.value;
		};
		return fn;
	};
	var _parseAsync = (_Err) => {
		const fn = async (schema, value, _ctx, params) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			if (result.issues.length) {
				const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
				captureStackTrace(e, params?.callee ?? fn);
				throw e;
			}
			return result.value;
		};
		return fn;
	};
	var _safeParse = (_Err) => (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			async: false
		} : { async: false };
		const result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) throw new $ZodAsyncError();
		return result.issues.length ? failure(_Err, result.issues, ctx) : {
			success: true,
			data: result.value
		};
	};
	function failure(Err, issues, ctx) {
		let error;
		return {
			success: false,
			get error() {
				if (!error) {
					error = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
					issues = void 0;
					ctx = void 0;
				}
				return error;
			},
			set error(e) {
				error = e;
				issues = void 0;
				ctx = void 0;
			}
		};
	}
	var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			async: true
		} : { async: true };
		let result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) result = await result;
		return result.issues.length ? failure(_Err, result.issues, ctx) : {
			success: true,
			data: result.value
		};
	};
	var COMPILE_INVALID = Symbol.for("zod.compile.invalid");
	var COMPILE_FALLBACK = Symbol.for("zod.compile.fallback");
	var validate = ((schema, value, _ctx) => {
		const validator = schema._zod.bag.validator;
		if (validator !== void 0) {
			if (validator(value) !== COMPILE_INVALID) return true;
			if (validator.definite === true && _ctx === void 0) return false;
		}
		return validateFallback(schema, value, _ctx);
	});
	function validateFallback(schema, value, _ctx) {
		const ctx = _ctx ? {
			..._ctx,
			async: false,
			abortEarly: true
		} : {
			async: false,
			abortEarly: true
		};
		const fallbackRun = schema._zod.bag.fallbackRun;
		let result;
		if (fallbackRun) {
			ctx[COMPILE_FALLBACK] = true;
			result = fallbackRun({
				value,
				issues: []
			}, ctx);
		} else result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) throw new $ZodAsyncError();
		return result.issues.length === 0;
	}
	var validateAsync$1 = async (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			async: true,
			abortEarly: true
		} : {
			async: true,
			abortEarly: true
		};
		let result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) result = await result;
		return result.issues.length === 0;
	};
	var _encode = (_Err) => {
		const parse = _parse(_Err);
		const fn = (schema, value, _ctx, _params) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return parse(schema, value, ctx, finalizeParams(fn, _params));
		};
		return fn;
	};
	var _decode = (_Err) => {
		const parse = _parse(_Err);
		const fn = (schema, value, _ctx, _params) => {
			return parse(schema, value, _ctx, finalizeParams(fn, _params));
		};
		return fn;
	};
	var _encodeAsync = (_Err) => {
		const parseAsync = _parseAsync(_Err);
		const fn = async (schema, value, _ctx, _params) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return await parseAsync(schema, value, ctx, finalizeParams(fn, _params));
		};
		return fn;
	};
	var _decodeAsync = (_Err) => {
		const parseAsync = _parseAsync(_Err);
		const fn = async (schema, value, _ctx, _params) => {
			return await parseAsync(schema, value, _ctx, finalizeParams(fn, _params));
		};
		return fn;
	};
	var _safeEncode = (_Err) => (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return _safeParse(_Err)(schema, value, ctx);
	};
	var _safeDecode = (_Err) => (schema, value, _ctx) => {
		return _safeParse(_Err)(schema, value, _ctx);
	};
	var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
		const ctx = _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" };
		return _safeParseAsync(_Err)(schema, value, ctx);
	};
	var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
		return _safeParseAsync(_Err)(schema, value, _ctx);
	};
	var cuid = /^[cC][0-9a-z]{6,}$/;
	var cuid2 = /^[0-9a-z]+$/;
	var ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
	var xid = /^[0-9a-vA-V]{20}$/;
	var ksuid = /^[A-Za-z0-9]{27}$/;
	var nanoid = /^[a-zA-Z0-9_-]{21}$/;
	function nanoidOfLength(length) {
		return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
	}
	var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
	var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
	var uuid = (version) => {
		if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
		return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
	};
	var email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
	var _emoji$1 = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
	function emoji() {
		return new RegExp(_emoji$1, "u");
	}
	var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
	var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
	var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
	var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
	var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
	var base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
	var httpProtocol = /^https?$/;
	var e164 = /^\+[1-9]\d{6,14}$/;
	var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
	function anchor(source) {
		return new RegExp(`^${source}$`);
	}
	var date = anchor(dateSource);
	function timeSource(args) {
		const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
		return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
	}
	function time(args) {
		return new RegExp(`^${timeSource(args)}$`);
	}
	function datetime(args) {
		const opts = ["Z"];
		if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
		const qualified = `${timeSource({
			precision: args.precision,
			seconds: true
		})}(?:${opts.join("|")})`;
		const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
		return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
	}
	var anyString = /^[\s\S]{0,}$/;
	var number$1 = /^-?\d+(?:\.\d+)?$/;
	var boolean$1 = /^(?:true|false)$/i;
	var lowercase = /^[^A-Z]*$/;
	var uppercase = /^[^a-z]*$/;
	var $ZodCheck = $constructor("$ZodCheck", (inst, def) => {
		var _a;
		inst._zod ?? (inst._zod = {});
		inst._zod.def = def;
		(_a = inst._zod).onattach ?? (_a.onattach = []);
	});
	var _whenHasLength = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	};
	var numericOriginMap = {
		number: "number",
		bigint: "bigint",
		object: "date"
	};
	var $ZodCheckLessThan = $constructor("$ZodCheckLessThan", (inst, def) => {
		$ZodCheck.init(inst, def);
		const origin = numericOriginMap[typeof def.value];
		inst._zod.check = (payload) => {
			if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
			payload.issues.push({
				origin: numericOriginMap[typeof payload.value] ?? origin,
				code: "too_big",
				maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
				input: payload.value,
				inclusive: def.inclusive,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckGreaterThan = $constructor("$ZodCheckGreaterThan", (inst, def) => {
		$ZodCheck.init(inst, def);
		const origin = numericOriginMap[typeof def.value];
		inst._zod.check = (payload) => {
			if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
			payload.issues.push({
				origin: numericOriginMap[typeof payload.value] ?? origin,
				code: "too_small",
				minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
				input: payload.value,
				inclusive: def.inclusive,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckMultipleOf = $constructor("$ZodCheckMultipleOf", (inst, def) => {
		$ZodCheck.init(inst, def);
		inst._zod.check = (payload) => {
			if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
			if (typeof payload.value === "bigint" ? def.value !== BigInt(0) && payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
			payload.issues.push({
				origin: typeof payload.value,
				code: "not_multiple_of",
				divisor: def.value,
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckNumberFormat = $constructor("$ZodCheckNumberFormat", (inst, def) => {
		$ZodCheck.init(inst, def);
		def.format = def.format || "float64";
		const isInt = def.format?.includes("int");
		const origin = isInt ? "int" : "number";
		const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
		inst._zod.check = (payload) => {
			const input = payload.value;
			if (isInt) {
				if (!Number.isInteger(input)) {
					payload.issues.push({
						expected: origin,
						format: def.format,
						code: "invalid_type",
						continue: false,
						input,
						inst
					});
					return;
				}
				if (!Number.isSafeInteger(input)) {
					if (input > 0) payload.issues.push({
						input,
						code: "too_big",
						maximum: Number.MAX_SAFE_INTEGER,
						note: "Integers must be within the safe integer range.",
						inst,
						origin,
						inclusive: true,
						continue: !def.abort
					});
					else payload.issues.push({
						input,
						code: "too_small",
						minimum: Number.MIN_SAFE_INTEGER,
						note: "Integers must be within the safe integer range.",
						inst,
						origin,
						inclusive: true,
						continue: !def.abort
					});
					return;
				}
			}
			if (input < minimum) payload.issues.push({
				origin: "number",
				input,
				code: "too_small",
				minimum,
				inclusive: true,
				inst,
				continue: !def.abort
			});
			if (input > maximum) payload.issues.push({
				origin: "number",
				input,
				code: "too_big",
				maximum,
				inclusive: true,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckMaxLength = $constructor("$ZodCheckMaxLength", (inst, def) => {
		var _a;
		$ZodCheck.init(inst, def);
		(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
		inst._zod.check = (payload) => {
			const input = payload.value;
			const units = input.length;
			if ((typeof input === "string" && units > def.maximum ? codePointLength(input) : units) <= def.maximum) return;
			const origin = getLengthableOrigin(input);
			payload.issues.push({
				origin,
				code: "too_big",
				maximum: def.maximum,
				inclusive: true,
				input,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckMinLength = $constructor("$ZodCheckMinLength", (inst, def) => {
		var _a;
		$ZodCheck.init(inst, def);
		(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
		inst._zod.check = (payload) => {
			const input = payload.value;
			const units = input.length;
			if ((typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units) >= def.minimum) return;
			const origin = getLengthableOrigin(input);
			payload.issues.push({
				origin,
				code: "too_small",
				minimum: def.minimum,
				inclusive: true,
				input,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckLengthEquals = $constructor("$ZodCheckLengthEquals", (inst, def) => {
		var _a;
		$ZodCheck.init(inst, def);
		(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
		inst._zod.check = (payload) => {
			const input = payload.value;
			const units = input.length;
			const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
			if (length === def.length) return;
			const origin = getLengthableOrigin(input);
			const tooBig = length > def.length;
			payload.issues.push({
				origin,
				...tooBig ? {
					code: "too_big",
					maximum: def.length
				} : {
					code: "too_small",
					minimum: def.length
				},
				inclusive: true,
				exact: true,
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckStringFormat = $constructor("$ZodCheckStringFormat", (inst, def) => {
		var _a, _b;
		$ZodCheck.init(inst, def);
		if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
			def.pattern.lastIndex = 0;
			if (def.pattern.test(payload.value)) return;
			payload.issues.push({
				origin: "string",
				code: "invalid_format",
				format: def.format,
				input: payload.value,
				...def.pattern ? { pattern: def.pattern.toString() } : {},
				inst,
				continue: !def.abort
			});
		});
		else (_b = inst._zod).check ?? (_b.check = () => {});
	});
	var $ZodCheckRegex = $constructor("$ZodCheckRegex", (inst, def) => {
		$ZodCheckStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			def.pattern.lastIndex = 0;
			if (def.pattern.test(payload.value)) return;
			payload.issues.push({
				origin: "string",
				code: "invalid_format",
				format: "regex",
				input: payload.value,
				pattern: def.pattern.toString(),
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckLowerCase = $constructor("$ZodCheckLowerCase", (inst, def) => {
		def.pattern ?? (def.pattern = lowercase);
		$ZodCheckStringFormat.init(inst, def);
	});
	var $ZodCheckUpperCase = $constructor("$ZodCheckUpperCase", (inst, def) => {
		def.pattern ?? (def.pattern = uppercase);
		$ZodCheckStringFormat.init(inst, def);
	});
	var $ZodCheckIncludes = $constructor("$ZodCheckIncludes", (inst, def) => {
		$ZodCheck.init(inst, def);
		const escapedRegex = escapeRegex(def.includes);
		def.pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
		inst._zod.check = (payload) => {
			if (payload.value.includes(def.includes, def.position)) return;
			payload.issues.push({
				origin: "string",
				code: "invalid_format",
				format: "includes",
				includes: def.includes,
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckStartsWith = $constructor("$ZodCheckStartsWith", (inst, def) => {
		$ZodCheck.init(inst, def);
		const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
		def.pattern ?? (def.pattern = pattern);
		inst._zod.check = (payload) => {
			if (payload.value.startsWith(def.prefix)) return;
			payload.issues.push({
				origin: "string",
				code: "invalid_format",
				format: "starts_with",
				prefix: def.prefix,
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckEndsWith = $constructor("$ZodCheckEndsWith", (inst, def) => {
		$ZodCheck.init(inst, def);
		const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
		def.pattern ?? (def.pattern = pattern);
		inst._zod.check = (payload) => {
			if (payload.value.endsWith(def.suffix)) return;
			payload.issues.push({
				origin: "string",
				code: "invalid_format",
				format: "ends_with",
				suffix: def.suffix,
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCheckOverwrite = $constructor("$ZodCheckOverwrite", (inst, def) => {
		$ZodCheck.init(inst, def);
		inst._zod.check = (payload) => {
			payload.value = def.tx(payload.value);
		};
	});
	var Doc = class {
		constructor(args = [], closed = {}) {
			this.content = [];
			this.indent = 0;
			this.args = args;
			this.closed = closed;
		}
		indented(fn) {
			this.indent += 1;
			try {
				fn(this);
			} finally {
				this.indent -= 1;
			}
		}
		write(arg) {
			if (typeof arg === "function") {
				arg(this, { execution: "sync" });
				arg(this, { execution: "async" });
				return;
			}
			const lines = arg.split("\n").filter((x) => x);
			const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
			const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
			for (const line of dedented) this.content.push(line);
		}
		compile() {
			const F = Function;
			const content = this?.content ?? [``];
			return new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {\n${content.join("\n")}\n};`)(...Object.values(this.closed));
		}
	};
	var version = {
		major: 4,
		minor: 6,
		patch: 7
	};
	var $ZodType = $constructor("$ZodType", (inst, def) => {
		var _a;
		inst ?? (inst = {});
		inst._zod.def = def;
		inst._zod.bag = inst._zod.bag || {};
		inst._zod.version = version;
		const defChecks = inst._zod.def.checks;
		const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
		for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
		if (checks.length === 0) {
			(_a = inst._zod).deferred ?? (_a.deferred = []);
			inst._zod.deferred?.push(() => {
				inst._zod.run = inst._zod.parse;
			});
		} else {
			const runChecks = (payload, checks, ctx) => {
				if (payload.memo) return payload;
				let isAborted = aborted(payload);
				let asyncResult;
				for (const ch of checks) {
					if (ch._zod.def.when) {
						if (explicitlyAborted(payload)) continue;
						if (!ch._zod.def.when(payload)) continue;
					} else if (isAborted) continue;
					const currLen = payload.issues.length;
					const _ = ch._zod.check(payload);
					if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
					if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
						await _;
						if (payload.issues.length === currLen) return;
						attachSchema(payload.issues, currLen, inst);
						if (!isAborted) isAborted = aborted(payload, currLen);
					});
					else {
						if (payload.issues.length === currLen) continue;
						attachSchema(payload.issues, currLen, inst);
						if (!isAborted) isAborted = aborted(payload, currLen);
					}
				}
				if (asyncResult) return asyncResult.then(() => {
					return payload;
				});
				return payload;
			};
			const handleCanaryResult = (canary, payload, ctx) => {
				if (aborted(canary)) {
					canary.aborted = true;
					return canary;
				}
				const checkResult = runChecks(payload, checks, ctx);
				if (checkResult instanceof Promise) {
					if (ctx.async === false) throw new $ZodAsyncError();
					return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
				}
				return inst._zod.parse(checkResult, ctx);
			};
			inst._zod.run = (payload, ctx) => {
				if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
				if (ctx.direction === "backward") {
					const canary = inst._zod.parse({
						value: payload.value,
						issues: []
					}, {
						...ctx,
						skipChecks: true
					});
					if (canary instanceof Promise) return canary.then((canary) => {
						return handleCanaryResult(canary, payload, ctx);
					});
					return handleCanaryResult(canary, payload, ctx);
				}
				const result = inst._zod.parse(payload, ctx);
				if (result instanceof Promise) {
					if (ctx.async === false) throw new $ZodAsyncError();
					return result.then((result) => runChecks(result, checks, ctx));
				}
				return runChecks(result, checks, ctx);
			};
		}
	}, {
		get "~standard"() {
			return hide(this, "~standard", standardProps(this));
		},
		set "~standard"(value) {
			own(this, "~standard", value);
		}
	});
	var toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
	async function validateAsync(inst, value) {
		const ctx = { async: true };
		return toStandardResult(await inst._zod.run({
			value,
			issues: []
		}, ctx), ctx);
	}
	function standardProps(inst) {
		return {
			validate: (value) => {
				const ctx = { async: false };
				try {
					const r = inst._zod.run({
						value,
						issues: []
					}, ctx);
					if (!(r instanceof Promise)) return toStandardResult(r, ctx);
				} catch (_) {}
				return validateAsync(inst, value);
			},
			vendor: "zod",
			version: 1
		};
	}
	var $ZodString = $constructor("$ZodString", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.pattern = def.pattern ?? anyString;
		inst._zod.parse = (payload, _) => {
			if (def.coerce) try {
				payload.value = String(payload.value);
			} catch (_) {}
			if (typeof payload.value === "string") return payload;
			payload.issues.push({
				expected: "string",
				code: "invalid_type",
				input: payload.value,
				inst
			});
			return payload;
		};
	});
	var $ZodStringFormat = $constructor("$ZodStringFormat", (inst, def) => {
		$ZodCheckStringFormat.init(inst, def);
		$ZodString.init(inst, def);
	});
	var $ZodGUID = $constructor("$ZodGUID", (inst, def) => {
		def.pattern ?? (def.pattern = guid);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodUUID = $constructor("$ZodUUID", (inst, def) => {
		if (def.version) {
			const v = {
				v1: 1,
				v2: 2,
				v3: 3,
				v4: 4,
				v5: 5,
				v6: 6,
				v7: 7,
				v8: 8
			}[def.version];
			if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
			def.pattern ?? (def.pattern = uuid(v));
		} else def.pattern ?? (def.pattern = uuid());
		$ZodStringFormat.init(inst, def);
	});
	var $ZodEmail = $constructor("$ZodEmail", (inst, def) => {
		def.pattern ?? (def.pattern = email);
		$ZodStringFormat.init(inst, def);
	});
	function canParseURL(input) {
		try {
			if (typeof URL !== "undefined" && typeof URL.canParse === "function") return URL.canParse(input);
			new URL(input);
			return true;
		} catch {
			return false;
		}
	}
	function validateURL(trimmed, def) {
		if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) return canParseURL(trimmed) || 2;
		return parseURLObject(trimmed, def);
	}
	function parseURLObject(trimmed, def) {
		if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) return 1;
		try {
			if (typeof URL !== "undefined") {
				const URLStatic = URL;
				if (typeof URLStatic.parse === "function") return URLStatic.parse(trimmed) ?? 2;
			}
			return new URL(trimmed);
		} catch {
			return 2;
		}
	}
	var asciiTabOrNewline = /[\t\n\r]/g;
	function stripTabAndNewline(value) {
		return value.replace(asciiTabOrNewline, "");
	}
	function urlHostnameOk(url, hostname) {
		hostname.lastIndex = 0;
		return hostname.test(url.hostname);
	}
	function urlProtocolOk(url, protocol) {
		protocol.lastIndex = 0;
		return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
	}
	var $ZodURL = $constructor("$ZodURL", (inst, def) => {
		$ZodStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			try {
				const trimmed = payload.value.trim();
				const url = validateURL(trimmed, def);
				if (url === 1) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid URL format",
						input: payload.value,
						inst,
						continue: !def.abort
					});
					return;
				}
				if (url === 2) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						input: payload.value,
						inst,
						continue: !def.abort
					});
					return;
				}
				if (url === true) {
					payload.value = stripTabAndNewline(trimmed);
					return;
				}
				if (def.hostname && !urlHostnameOk(url, def.hostname)) payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid hostname",
					pattern: def.hostname.source,
					input: payload.value,
					inst,
					continue: !def.abort
				});
				if (def.protocol && !urlProtocolOk(url, def.protocol)) payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid protocol",
					pattern: def.protocol.source,
					input: payload.value,
					inst,
					continue: !def.abort
				});
				payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
				return;
			} catch (_) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
		};
	});
	var $ZodEmoji = $constructor("$ZodEmoji", (inst, def) => {
		def.pattern ?? (def.pattern = emoji());
		$ZodStringFormat.init(inst, def);
	});
	var $ZodNanoID = $constructor("$ZodNanoID", (inst, def) => {
		if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1)) throw new Error(`Invalid nanoid length: ${def.length}`);
		def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
		$ZodStringFormat.init(inst, def);
	});
	var $ZodCUID = $constructor("$ZodCUID", (inst, def) => {
		def.pattern ?? (def.pattern = cuid);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodCUID2 = $constructor("$ZodCUID2", (inst, def) => {
		def.pattern ?? (def.pattern = cuid2);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodULID = $constructor("$ZodULID", (inst, def) => {
		def.pattern ?? (def.pattern = ulid);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodXID = $constructor("$ZodXID", (inst, def) => {
		def.pattern ?? (def.pattern = xid);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodKSUID = $constructor("$ZodKSUID", (inst, def) => {
		def.pattern ?? (def.pattern = ksuid);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodISODateTime = $constructor("$ZodISODateTime", (inst, def) => {
		def.pattern ?? (def.pattern = datetime(def));
		$ZodStringFormat.init(inst, def);
	});
	var $ZodISODate = $constructor("$ZodISODate", (inst, def) => {
		def.pattern ?? (def.pattern = date);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodISOTime = $constructor("$ZodISOTime", (inst, def) => {
		def.pattern ?? (def.pattern = time(def));
		$ZodStringFormat.init(inst, def);
	});
	var $ZodISODuration = $constructor("$ZodISODuration", (inst, def) => {
		def.pattern ?? (def.pattern = duration);
		$ZodStringFormat.init(inst, def);
	});
	var $ZodIPv4 = $constructor("$ZodIPv4", (inst, def) => {
		def.pattern ?? (def.pattern = ipv4);
		$ZodStringFormat.init(inst, def);
	});
	var ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
	function isValidIPv6(value) {
		if (!ipv6Alphabet.test(value)) return false;
		return canParseURL(`http://[${value}]`);
	}
	var $ZodIPv6 = $constructor("$ZodIPv6", (inst, def) => {
		def.pattern ?? (def.pattern = ipv6);
		$ZodStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			if (!isValidIPv6(payload.value)) payload.issues.push({
				code: "invalid_format",
				format: "ipv6",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodCIDRv4 = $constructor("$ZodCIDRv4", (inst, def) => {
		def.pattern ?? (def.pattern = cidrv4);
		$ZodStringFormat.init(inst, def);
	});
	function isValidCIDRv6(value) {
		const parts = value.split("/");
		if (parts.length !== 2) return false;
		const [address, prefix] = parts;
		if (!prefix) return false;
		const prefixNum = Number(prefix);
		if (`${prefixNum}` !== prefix) return false;
		if (prefixNum < 0 || prefixNum > 128) return false;
		return isValidIPv6(address);
	}
	var $ZodCIDRv6 = $constructor("$ZodCIDRv6", (inst, def) => {
		def.pattern ?? (def.pattern = cidrv6);
		$ZodStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			if (!isValidCIDRv6(payload.value)) payload.issues.push({
				code: "invalid_format",
				format: "cidrv6",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	function isValidBase64(data) {
		if (data === "") return true;
		if (/\s/.test(data)) return false;
		if (data.length % 4 !== 0) return false;
		try {
			atob(data);
			return true;
		} catch {
			return false;
		}
	}
	var base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
	var $ZodBase64 = $constructor("$ZodBase64", (inst, def) => {
		def.pattern ?? (def.pattern = base64Charset);
		$ZodStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			if (isValidBase64(payload.value)) return;
			payload.issues.push({
				code: "invalid_format",
				format: "base64",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var base64urlCharset = /^[A-Za-z0-9_-]*$/;
	function isValidBase64URL(data) {
		if (!base64urlCharset.test(data)) return false;
		const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
		return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
	}
	var $ZodBase64URL = $constructor("$ZodBase64URL", (inst, def) => {
		def.pattern ?? (def.pattern = base64urlCharset);
		$ZodStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			if (isValidBase64URL(payload.value)) return;
			payload.issues.push({
				code: "invalid_format",
				format: "base64url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodE164 = $constructor("$ZodE164", (inst, def) => {
		def.pattern ?? (def.pattern = e164);
		$ZodStringFormat.init(inst, def);
	});
	function isValidJWT(token, algorithm = null) {
		try {
			const tokensParts = token.split(".");
			if (tokensParts.length !== 3) return false;
			const [header] = tokensParts;
			if (!header) return false;
			const parsedHeader = JSON.parse(atob(header));
			if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
			if (!parsedHeader.alg) return false;
			if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
			return true;
		} catch {
			return false;
		}
	}
	var $ZodJWT = $constructor("$ZodJWT", (inst, def) => {
		$ZodStringFormat.init(inst, def);
		inst._zod.check = (payload) => {
			if (isValidJWT(payload.value, def.alg)) return;
			payload.issues.push({
				code: "invalid_format",
				format: "jwt",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		};
	});
	var $ZodNumber = $constructor("$ZodNumber", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.pattern = number$1;
		inst._zod.parse = (payload, _ctx) => {
			if (def.coerce) try {
				payload.value = Number(payload.value);
			} catch (_) {}
			const input = payload.value;
			if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
			const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
			payload.issues.push({
				expected: "number",
				code: "invalid_type",
				input,
				inst,
				...received ? { received } : {}
			});
			return payload;
		};
	});
	var $ZodNumberFormat = $constructor("$ZodNumberFormat", (inst, def) => {
		$ZodCheckNumberFormat.init(inst, def);
		$ZodNumber.init(inst, def);
	});
	var $ZodBoolean = $constructor("$ZodBoolean", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.pattern = boolean$1;
		inst._zod.parse = (payload, _ctx) => {
			if (def.coerce) try {
				payload.value = Boolean(payload.value);
			} catch (_) {}
			const input = payload.value;
			if (typeof input === "boolean") return payload;
			payload.issues.push({
				expected: "boolean",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		};
	});
	var $ZodUnknown = $constructor("$ZodUnknown", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.parse = (payload) => payload;
	});
	var $ZodNever = $constructor("$ZodNever", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.parse = (payload, _ctx) => {
			payload.issues.push({
				expected: "never",
				code: "invalid_type",
				input: payload.value,
				inst
			});
			return payload;
		};
	});
	function capSize(inst, size) {
		const caps = sizeCaps(inst._zod.def.checks);
		if (!caps.length) return;
		const cap = Math.min(...caps.map((c) => c[0]));
		const parse = inst._zod.parse;
		inst._zod.parse = (payload, ctx) => {
			const n = size(payload.value);
			if (n > cap && !ctx?.skipChecks && ctx?.direction !== "backward") {
				for (const [max, ch] of sizeCaps(inst._zod.def.checks)) if (n > max && ch._zod.def.when(payload)) {
					const start = payload.issues.length;
					ch._zod.check(payload);
					payload.issues[start].continue = false;
					attachSchema(payload.issues, start, inst);
					return payload;
				}
			}
			return parse(payload, ctx);
		};
	}
	var arraySize = (input) => Array.isArray(input) ? input.length : -1;
	function handleArrayResult(result, final, index) {
		if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
		final.value[index] = result.value;
	}
	var $ZodArray = $constructor("$ZodArray", (inst, def) => {
		$ZodType.init(inst, def);
		const memo = globalConfig.memoizer;
		memo?.attach(inst);
		inst._zod.parse = (payload, ctx) => {
			const input = payload.value;
			if (!Array.isArray(input)) {
				payload.issues.push({
					expected: "array",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			}
			payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
			const proms = [];
			const abortEarly = ctx?.abortEarly;
			for (let i = 0; i < input.length; i++) {
				const item = input[i];
				const result = def.element._zod.run({
					value: item,
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
				else {
					handleArrayResult(result, payload, i);
					if (abortEarly && result.issues.length !== 0 && aborted(result)) break;
				}
			}
			if (proms.length) return Promise.all(proms).then(() => payload);
			return payload;
		};
		capSize(inst, arraySize);
	});
	function handlePropertyResult(result, final, key, input, optin, optout) {
		const isPresent = key in input;
		const isOptionalOut = optout === "optional";
		if (!isPresent && isOptionalOut && optin === "optional") return;
		if (result.issues.length) {
			if (optin !== void 0 && isOptionalOut && !isPresent) return;
			final.issues.push(...prefixIssues(key, result.issues));
		}
		if (!isPresent && optin === void 0) {
			if (!result.issues.length) final.issues.push({
				code: "invalid_type",
				expected: "nonoptional",
				input: void 0,
				path: [key]
			});
			return;
		}
		if (result.value === void 0) {
			if (isPresent || optin === "defaulted" && !isOptionalOut) final.value[key] = void 0;
		} else final.value[key] = result.value;
	}
	var NO_SYMBOL_KEYS = [];
	function normalizeDef(def) {
		const keys = Object.keys(def.shape);
		const ownSymbols = Object.getOwnPropertySymbols(def.shape);
		const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
		const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
		for (const k of allKeys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
		const okeys = optionalKeys(def.shape);
		return {
			...def,
			allKeys,
			symbolKeys,
			keySet: new Set(keys),
			numKeys: keys.length,
			optionalKeys: new Set(okeys)
		};
	}
	function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
		const unrecognized = [];
		const keySet = def.keySet;
		const _catchall = def.catchall._zod;
		const t = _catchall.def.type;
		const optin = _catchall.optin;
		const optout = _catchall.optout;
		let seen = 0;
		for (const key in input) {
			if (abortEarly && payload.issues.length !== seen) {
				if (aborted(payload, seen)) break;
				seen = payload.issues.length;
			}
			if (keySet.has(key)) continue;
			if (key === "__proto__") {
				if (t === "never") unrecognized.push(key);
				continue;
			}
			if (t === "never") {
				unrecognized.push(key);
				continue;
			}
			const r = _catchall.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
			else handlePropertyResult(r, payload, key, input, optin, optout);
		}
		if (unrecognized.length) payload.issues.push({
			code: "unrecognized_keys",
			keys: unrecognized,
			input,
			inst,
			continue: true
		});
		if (!proms.length) return payload;
		return Promise.all(proms).then(() => {
			return payload;
		});
	}
	var $ZodObject = $constructor("$ZodObject", (inst, def) => {
		$ZodType.init(inst, def);
		const desc = Object.getOwnPropertyDescriptor(def, "shape");
		const sh = desc?.get ? desc.get.raw : def.shape ?? {};
		if (sh) {
			const get = () => {
				const newSh = { ...sh };
				Object.defineProperty(def, "shape", { value: newSh });
				get.raw = newSh;
				return newSh;
			};
			get.raw = sh;
			Object.defineProperty(def, "shape", { get });
		}
		const _normalized = cached(() => normalizeDef(def));
		defineLazyInternal(inst, "propValues", (zod) => {
			const shape = zod.def.shape;
			const propValues = {};
			for (const key in shape) {
				const field = shape[key]._zod;
				if (field.values) {
					if (!Object.prototype.hasOwnProperty.call(propValues, key)) assignProp(propValues, key, new Set());
					for (const v of field.values) propValues[key].add(v);
					if (field.optin !== void 0) propValues[key].add(void 0);
				}
			}
			return propValues;
		});
		const isObject$1 = isObject;
		const catchall = def.catchall;
		let value;
		const memo = globalConfig.memoizer;
		memo?.attach(inst);
		inst._zod.parse = (payload, ctx) => {
			value ?? (value = _normalized.value);
			const input = payload.value;
			if (!isObject$1(input)) {
				payload.issues.push({
					expected: "object",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			}
			payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
			const proms = [];
			const shape = value.shape;
			const abortEarly = ctx?.abortEarly;
			let seen = payload.issues.length;
			for (const key of value.allKeys) {
				if (abortEarly && payload.issues.length !== seen) {
					if (aborted(payload, seen)) break;
					seen = payload.issues.length;
				}
				if (key === "__proto__") continue;
				const el = shape[key];
				const optin = el._zod.optin;
				const optout = el._zod.optout;
				const r = el._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
				else handlePropertyResult(r, payload, key, input, optin, optout);
			}
			if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
			return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
		};
	});
	var $ZodObjectJIT = $constructor("$ZodObjectJIT", (inst, def) => {
		$ZodObject.init(inst, def);
		const superParse = inst._zod.parse;
		const _normalized = cached(() => normalizeDef(def));
		const memo = globalConfig.memoizer;
		const generateFastpass = (shape) => {
			const normalized = _normalized.value;
			const syms = normalized.symbolKeys;
			const doc = new Doc(["payload", "ctx"], {
				shape,
				inst,
				memo,
				syms
			});
			const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
			const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
			doc.write(`const input = payload.value;`);
			const ids = Object.create(null);
			let counter = 0;
			for (const key of normalized.allKeys) ids[key] = `key_${counter++}`;
			doc.write(memo ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
			for (const key of normalized.allKeys) {
				if (key === "__proto__") continue;
				const id = ids[key];
				const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
				const isPresent = `${k} in input`;
				const schema = shape[key];
				const optin = schema?._zod?.optin;
				const isOptionalIn = optin !== void 0;
				const isOptionalOut = schema?._zod?.optout === "optional";
				doc.write(`const ${id} = ${parseStr(k)};`);
				if (isOptionalIn && isOptionalOut) {
					const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
					doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
				} else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
				else {
					doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
					if (optin === "defaulted") doc.write(`newResult[${k}] = ${id}.value;`);
					else doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
				}
			}
			doc.write(`payload.value = newResult;`);
			doc.write(`return payload;`);
			return doc.compile();
		};
		let fastpass;
		const isObject$2 = isObject;
		const jit = !globalConfig.jitless;
		const fastEnabled = jit && allowsEval.value;
		const catchall = def.catchall;
		let value;
		inst._zod.parse = (payload, ctx) => {
			value ?? (value = _normalized.value);
			const input = payload.value;
			if (!isObject$2(input)) {
				payload.issues.push({
					expected: "object",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			}
			if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
				if (!fastpass) fastpass = generateFastpass(def.shape);
				payload = fastpass(payload, ctx);
				if (!catchall) return payload;
				return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
			}
			return superParse(payload, ctx);
		};
	});
	function handleUnionResults(results, final, inst, ctx) {
		for (const result of results) if (result.issues.length === 0) {
			final.value = result.value;
			return final;
		}
		const nonaborted = results.filter((r) => !aborted(r));
		if (nonaborted.length === 1) {
			final.value = nonaborted[0].value;
			return nonaborted[0];
		}
		final.issues.push({
			code: "invalid_union",
			input: final.value,
			inst,
			errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
		});
		return final;
	}
	var $ZodUnion = $constructor("$ZodUnion", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
		defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
		defineLazyInternal(inst, "values", (zod) => {
			if (zod.def.options.every((o) => o._zod.values)) return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
		});
		defineLazyInternal(inst, "pattern", (zod) => {
			if (zod.def.options.every((o) => o._zod.pattern)) {
				const patterns = zod.def.options.map((o) => o._zod.pattern);
				return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
			}
		});
		const first = def.options.length === 1 ? def.options[0]._zod.run : null;
		inst._zod.parse = (payload, ctx) => {
			if (first) return first(payload, ctx);
			let async = false;
			const results = [];
			for (const option of def.options) {
				const result = option._zod.run({
					value: payload.value,
					issues: []
				}, ctx);
				if (result instanceof Promise) {
					results.push(result);
					async = true;
				} else {
					if (result.issues.length === 0) return result;
					results.push(result);
				}
			}
			if (!async) return handleUnionResults(results, payload, inst, ctx);
			return Promise.all(results).then((results) => {
				return handleUnionResults(results, payload, inst, ctx);
			});
		};
	});
	var $ZodIntersection = $constructor("$ZodIntersection", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.parse = (payload, ctx) => {
			const input = payload.value;
			const left = def.left._zod.run({
				value: input,
				issues: []
			}, ctx);
			const right = def.right._zod.run({
				value: input,
				issues: []
			}, ctx);
			if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
				return handleIntersectionResults(payload, left, right);
			});
			return handleIntersectionResults(payload, left, right);
		};
	});
	function mergeValues(a, b) {
		if (a === b) return {
			valid: true,
			data: a
		};
		if (a instanceof Date && b instanceof Date && +a === +b) return {
			valid: true,
			data: a
		};
		if (isPlainObject(a) && isPlainObject(b)) {
			const bKeys = Object.keys(b);
			const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
			const newObj = {
				...a,
				...b
			};
			if (Object.prototype.hasOwnProperty.call(newObj, "__proto__")) delete newObj.__proto__;
			for (const key of sharedKeys) {
				if (key === "__proto__") continue;
				const sharedValue = mergeValues(a[key], b[key]);
				if (!sharedValue.valid) return {
					valid: false,
					mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
				};
				newObj[key] = sharedValue.data;
			}
			return {
				valid: true,
				data: newObj
			};
		}
		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) return {
				valid: false,
				mergeErrorPath: []
			};
			const newArray = [];
			for (let index = 0; index < a.length; index++) {
				const itemA = a[index];
				const itemB = b[index];
				const sharedValue = mergeValues(itemA, itemB);
				if (!sharedValue.valid) return {
					valid: false,
					mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
				};
				newArray.push(sharedValue.data);
			}
			return {
				valid: true,
				data: newArray
			};
		}
		return {
			valid: false,
			mergeErrorPath: []
		};
	}
	function handleIntersectionResults(result, left, right) {
		const unrecKeys = new Map();
		let unrecIssue;
		const keyIssues = new Map();
		const collect = (iss, side) => {
			let keys;
			if (iss.code === "unrecognized_keys" && !iss.path?.length) {
				unrecIssue ?? (unrecIssue = iss);
				keys = iss.keys;
			} else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
				const k = String(iss.path[0]);
				if (!keyIssues.has(k)) keyIssues.set(k, iss);
				keys = [k];
			} else return false;
			for (const k of keys) {
				if (!unrecKeys.has(k)) unrecKeys.set(k, {});
				unrecKeys.get(k)[side] = true;
			}
			return true;
		};
		for (const iss of left.issues) if (!collect(iss, "l")) result.issues.push(iss);
		for (const iss of right.issues) if (!collect(iss, "r")) result.issues.push(iss);
		const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
		if (bothKeys.length) {
			const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
			if (aggregated.length) result.issues.push({
				...unrecIssue,
				keys: aggregated
			});
			for (const k of bothKeys) if (!aggregated.includes(k) && keyIssues.has(k)) result.issues.push(keyIssues.get(k));
		}
		const merged = mergeValues(left.value, right.value);
		if (!merged.valid) {
			if (aborted(result)) return result;
			throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
		}
		result.value = merged.data;
		return result;
	}
	var $ZodEnum = $constructor("$ZodEnum", (inst, def) => {
		$ZodType.init(inst, def);
		const values = getEnumValues(def.entries);
		const valuesSet = new Set(values);
		inst._zod.values = valuesSet;
		defineLazyInternal(inst, "pattern", (zod) => {
			const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
			return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
		});
		inst._zod.parse = (payload, _ctx) => {
			const input = payload.value;
			if (valuesSet.has(input)) return payload;
			payload.issues.push({
				code: "invalid_value",
				values,
				input,
				inst
			});
			return payload;
		};
	});
	var $ZodTransform = $constructor("$ZodTransform", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.optin = "optional";
		globalConfig.memoizer?.guard(inst);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
			const _out = def.transform(payload.value, payload);
			if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
				payload.value = output;
				return payload;
			});
			if (_out instanceof Promise) throw new $ZodAsyncError();
			payload.value = _out;
			return payload;
		};
	});
	function handleOptionalResult(payload, result) {
		payload.value = result.issues.length ? void 0 : result.value;
		return payload;
	}
	var $ZodOptional = $constructor("$ZodOptional", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
		inst._zod.optout = "optional";
		defineLazyInternal(inst, "values", (zod) => {
			const values = zod.def.innerType._zod.values;
			return values ? new Set([...values, void 0]) : void 0;
		});
		defineLazyInternal(inst, "pattern", (zod) => {
			const pattern = zod.def.innerType._zod.pattern;
			return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
		});
		inst._zod.parse = (payload, ctx) => {
			if (payload.value === void 0) {
				if (def.innerType._zod.optin !== "defaulted") return payload;
				const result = def.innerType._zod.run({
					value: payload.value,
					issues: []
				}, ctx);
				if (result instanceof Promise) return result.then((result) => handleOptionalResult(payload, result));
				return handleOptionalResult(payload, result);
			}
			return def.innerType._zod.run(payload, ctx);
		};
	});
	var $ZodExactOptional = $constructor("$ZodExactOptional", (inst, def) => {
		$ZodOptional.init(inst, def);
		defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
		defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
		inst._zod.parse = (payload, ctx) => {
			return def.innerType._zod.run(payload, ctx);
		};
	});
	var $ZodNullable = $constructor("$ZodNullable", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
		defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
		defineLazyInternal(inst, "pattern", (zod) => {
			const pattern = zod.def.innerType._zod.pattern;
			return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
		});
		defineLazyInternal(inst, "values", (zod) => {
			return zod.def.innerType._zod.values ? new Set([...zod.def.innerType._zod.values, null]) : void 0;
		});
		inst._zod.parse = (payload, ctx) => {
			if (payload.value === null) return payload;
			return def.innerType._zod.run(payload, ctx);
		};
	});
	var $ZodDefault = $constructor("$ZodDefault", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.optin = "defaulted";
		defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
			if (payload.value === void 0) {
				payload.value = def.defaultValue;
				return payload;
			}
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
			return handleDefaultResult(result, def);
		};
	});
	function handleDefaultResult(payload, def) {
		if (payload.value === void 0) payload.value = def.defaultValue;
		return payload;
	}
	var $ZodPrefault = $constructor("$ZodPrefault", (inst, def) => {
		$ZodType.init(inst, def);
		inst._zod.optin = "defaulted";
		defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
			if (payload.value === void 0) payload.value = def.defaultValue;
			return def.innerType._zod.run(payload, ctx);
		};
	});
	var $ZodNonOptional = $constructor("$ZodNonOptional", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazyInternal(inst, "values", (zod) => {
			const v = zod.def.innerType._zod.values;
			return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
		});
		inst._zod.parse = (payload, ctx) => {
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
			return handleNonOptionalResult(result, inst);
		};
	});
	function handleNonOptionalResult(payload, inst) {
		if (!payload.issues.length && payload.value === void 0) payload.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: payload.value,
			inst
		});
		return payload;
	}
	function handleCatchResult(payload, result, def, ctx) {
		if (!result.issues.length) {
			payload.value = result.value;
			if (result.memo) payload.memo = true;
			return payload;
		}
		payload.value = def.catchValue({
			...result,
			value: payload.value,
			error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
			input: payload.value
		});
		return payload;
	}
	var $ZodCatch = $constructor("$ZodCatch", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
		defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
		defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
			const result = def.innerType._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) return result.then((result) => handleCatchResult(payload, result, def, ctx));
			return handleCatchResult(payload, result, def, ctx);
		};
	});
	var $ZodPipe = $constructor("$ZodPipe", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
		defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
		defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
		defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") {
				const right = def.out._zod.run(payload, ctx);
				if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
				return handlePipeResult(right, def.in, ctx);
			}
			const left = def.in._zod.run(payload, ctx);
			if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
			return handlePipeResult(left, def.out, ctx);
		};
	});
	function handlePipeResult(left, next, ctx) {
		if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
			left.aborted = true;
			return left;
		}
		return next._zod.run({
			value: left.value,
			issues: left.issues
		}, ctx);
	}
	var $ZodReadonly = $constructor("$ZodReadonly", (inst, def) => {
		$ZodType.init(inst, def);
		defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
		defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
		defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
		defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
		inst._zod.parse = (payload, ctx) => {
			if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then(handleReadonlyResult);
			return handleReadonlyResult(result);
		};
	});
	function handleReadonlyResult(payload) {
		if (!payload.memo) payload.value = Object.freeze(payload.value);
		return payload;
	}
	var $ZodCustom = $constructor("$ZodCustom", (inst, def) => {
		$ZodCheck.init(inst, def);
		$ZodType.init(inst, def);
		inst._zod.parse = (payload, _) => {
			return payload;
		};
		inst._zod.check = (payload) => {
			const input = payload.value;
			const r = def.fn(input);
			if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
			handleRefineResult(r, payload, input, inst);
		};
	});
	function handleRefineResult(result, payload, input, inst) {
		if (!result) {
			const _iss = {
				code: "custom",
				input,
				inst,
				path: [...inst._zod.def.path ?? []],
				continue: !inst._zod.def.abort
			};
			if (inst._zod.def.params) _iss.params = inst._zod.def.params;
			payload.issues.push(issue(_iss));
		}
	}
	var $ZodCyclicError = class extends Error {
		constructor() {
			super(`Cannot parse a reference cycle that closes through a transform`);
			this.name = "ZodCyclicError";
		}
	};
	var STATE = "~memo";
	var NO_ISSUES = [];
	function isRef(value) {
		return value !== null && typeof value === "object";
	}
	function cloneIssues(issues) {
		return issues.map((iss) => iss.path ? {
			...iss,
			path: iss.path.slice()
		} : { ...iss });
	}
	var recursive = new WeakMap();
	var NONE = 0;
	var ASSUMED = 1;
	var PROVEN = 2;
	function isRecursive(inst, stack, resolve) {
		const cached = recursive.get(inst);
		if (cached !== void 0) return cached ? PROVEN : NONE;
		if (stack.has(inst)) return PROVEN;
		stack.add(inst);
		let result = NONE;
		const check = (child) => {
			if (result !== PROVEN && child?._zod) {
				const answer = isRecursive(child, stack, resolve);
				if (answer > result) result = answer;
			}
		};
		const shape = (sh, spread) => {
			let answer = NONE;
			for (const key of Reflect.ownKeys(sh)) {
				const desc = Object.getOwnPropertyDescriptor(sh, key);
				if (spread && !desc.enumerable) continue;
				const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
				if (child > answer) answer = child;
			}
			return answer;
		};
		const merge = (answer) => {
			if (answer > result) result = answer;
		};
		const def = inst._zod.def;
		switch (def.type) {
			case "object": {
				const raw = rawShape(def);
				merge(raw ? shape(raw, true) : ASSUMED);
				check(def.catchall);
				break;
			}
			case "array":
				check(def.element);
				break;
			case "tuple":
				for (const el of def.items) check(el);
				check(def.rest);
				break;
			case "record":
			case "map":
				check(def.keyType);
				check(def.valueType);
				break;
			case "set":
				check(def.valueType);
				break;
			case "union":
				for (const el of def.options) check(el);
				break;
			case "intersection":
				check(def.left);
				check(def.right);
				break;
			case "optional":
			case "nullable":
			case "default":
			case "prefault":
			case "catch":
			case "readonly":
			case "nonoptional":
			case "promise":
			case "success":
				check(def.innerType);
				break;
			case "pipe":
				check(def.in);
				check(def.out);
				break;
			case "function":
				check(def.input);
				check(def.output);
				break;
			case "lazy": {
				const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : void 0);
				merge(inner ? isRecursive(inner, stack, false) : ASSUMED);
				break;
			}
			case "template_literal":
			case "string":
			case "number":
			case "int":
			case "boolean":
			case "bigint":
			case "symbol":
			case "undefined":
			case "null":
			case "void":
			case "never":
			case "any":
			case "unknown":
			case "date":
			case "nan":
			case "enum":
			case "literal":
			case "file":
			case "transform":
			case "custom": break;
			default: for (const key in def) {
				const desc = Object.getOwnPropertyDescriptor(def, key);
				if (!desc || desc.get) continue;
				const value = desc.value;
				if (!value || typeof value !== "object") continue;
				if (value._zod) check(value);
				else if (Array.isArray(value)) for (const el of value) check(el);
			}
		}
		stack.delete(inst);
		return settle(inst, result);
	}
	function settle(inst, answer) {
		if (answer !== ASSUMED) recursive.set(inst, answer === PROVEN);
		return answer;
	}
	function bucketFor(state, inst) {
		let bucket = state.buckets.get(inst);
		if (!bucket) {
			bucket = new WeakMap();
			state.buckets.set(inst, bucket);
		}
		return bucket;
	}
	var handoff;
	var open = [];
	var memo = {
		alloc(_inst, payload, empty) {
			const bucket = handoff;
			if (!bucket) return empty;
			handoff = void 0;
			const entry = {
				value: empty,
				issues: null
			};
			bucket.set(payload.value, entry);
			open.push(entry);
			return empty;
		},
		guard(inst) {
			var _a;
			(_a = inst._zod).deferred ?? (_a.deferred = []);
			inst._zod.deferred.push(() => {
				const base = inst._zod.parse;
				const wrapped = (payload, ctx) => {
					if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value)) throw new $ZodCyclicError();
					return base(payload, ctx);
				};
				inst._zod.parse = wrapped;
				if (inst._zod.run === base) inst._zod.run = wrapped;
			});
		},
		attach(inst) {
			var _a;
			let isRecursiveInst;
			let rechecked = false;
			let lastCtx;
			let lastBucket;
			(_a = inst._zod).deferred ?? (_a.deferred = []);
			inst._zod.deferred.push(() => {
				const base = inst._zod.parse;
				const wrapped = (payload, ctx) => {
					if (isRecursiveInst === void 0) {
						const walked = isRecursive(inst, new Set(), false);
						if (walked === NONE) {
							inst._zod.parse = base;
							if (inst._zod.run === wrapped) inst._zod.run = base;
							return base(payload, ctx);
						}
						if (walked === PROVEN || rechecked) isRecursiveInst = true;
						else rechecked = true;
					}
					const input = payload.value;
					if (!isRef(input)) return base(payload, ctx);
					let state = ctx[STATE];
					if (!state) {
						state = {
							buckets: new WeakMap(),
							backEdges: void 0
						};
						ctx[STATE] = state;
					}
					let bucket;
					if (lastCtx === ctx) bucket = lastBucket;
					else {
						bucket = bucketFor(state, inst);
						lastCtx = ctx;
						lastBucket = bucket;
					}
					const hit = bucket.get(input);
					if (hit) {
						payload.value = hit.value;
						if (hit.issues) {
							if (hit.issues.length) payload.issues.push(...cloneIssues(hit.issues));
						} else {
							payload.memo = true;
							state.backEdges ?? (state.backEdges = new WeakSet());
							state.backEdges.add(hit.value);
						}
						return payload;
					}
					handoff = bucket;
					const depth = open.length;
					const result = base(payload, ctx);
					handoff = void 0;
					const entry = open.length > depth ? open.pop() : void 0;
					if (result instanceof Promise) return result.then((r) => {
						if (entry) entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
						return r;
					});
					if (entry) entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
					return result;
				};
				inst._zod.parse = wrapped;
				if (inst._zod.run === base) inst._zod.run = wrapped;
			});
		}
	};
	function memoizer() {
		return memo;
	}
	function isBackEdge(ctx, value) {
		const backEdges = ctx[STATE]?.backEdges;
		return backEdges !== void 0 && isRef(value) && backEdges.has(value);
	}
	var error = () => {
		const Sizable = {
			string: {
				unit: "characters",
				verb: "to have"
			},
			file: {
				unit: "bytes",
				verb: "to have"
			},
			array: {
				unit: "items",
				verb: "to have"
			},
			set: {
				unit: "items",
				verb: "to have"
			},
			map: {
				unit: "entries",
				verb: "to have"
			}
		};
		function getSizing(origin) {
			return Sizable[origin] ?? null;
		}
		const FormatDictionary = {
			regex: "input",
			email: "email address",
			url: "URL",
			emoji: "emoji",
			uuid: "UUID",
			uuidv4: "UUIDv4",
			uuidv6: "UUIDv6",
			nanoid: "nanoid",
			guid: "GUID",
			cuid: "cuid",
			cuid2: "cuid2",
			ulid: "ULID",
			xid: "XID",
			ksuid: "KSUID",
			datetime: "ISO datetime",
			date: "ISO date",
			time: "ISO time",
			duration: "ISO duration",
			ipv4: "IPv4 address",
			ipv6: "IPv6 address",
			mac: "MAC address",
			cidrv4: "IPv4 range",
			cidrv6: "IPv6 range",
			base64: "base64-encoded string",
			base64url: "base64url-encoded string",
			json_string: "JSON string",
			e164: "E.164 number",
			currency_code: "currency code",
			credit_card: "credit card number",
			iban: "IBAN",
			jwt: "JWT",
			template_literal: "input"
		};
		const TypeDictionary = { nan: "NaN" };
		function getTypeName(type, input) {
			if (type === "number" && typeof input === "number" && !Number.isFinite(input)) return String(input);
			return TypeDictionary[type] ?? type;
		}
		return (issue) => {
			switch (issue.code) {
				case "invalid_type": return `Invalid input: expected ${getTypeName(issue.expected)}, received ${getTypeName(parsedType(issue.input), issue.input)}`;
				case "invalid_value":
					if (issue.values.length === 1) return `Invalid input: expected ${stringifyPrimitive(issue.values[0])}`;
					return `Invalid option: expected one of ${joinValues(issue.values, "|")}`;
				case "too_big": {
					const adj = issue.exact ? "exactly " : issue.inclusive ? "<=" : "<";
					const sizing = getSizing(issue.origin);
					if (sizing) return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
					return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
				}
				case "too_small": {
					const adj = issue.exact ? "exactly " : issue.inclusive ? ">=" : ">";
					const sizing = getSizing(issue.origin);
					if (sizing) return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
					return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
				}
				case "invalid_format": {
					const _issue = issue;
					if (_issue.format === "starts_with") return `Invalid string: must start with "${_issue.prefix}"`;
					if (_issue.format === "ends_with") return `Invalid string: must end with "${_issue.suffix}"`;
					if (_issue.format === "includes") return `Invalid string: must include "${_issue.includes}"`;
					if (_issue.format === "regex") return `Invalid string: must match pattern ${_issue.pattern}`;
					return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
				}
				case "not_multiple_of": return `Invalid number: must be a multiple of ${issue.divisor}`;
				case "unrecognized_keys": return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${joinValues(issue.keys, ", ")}`;
				case "invalid_key": return `Invalid key in ${issue.origin}`;
				case "invalid_union":
					if (issue.options && Array.isArray(issue.options) && issue.options.length > 0) return `Invalid discriminator value. Expected ${issue.options.map((o) => `'${o}'`).join(" | ")}`;
					if (issue.inclusive === false) return "Invalid input: more than one option matched";
					return "Invalid input";
				case "invalid_element": return `Invalid value in ${issue.origin}`;
				default: return `Invalid input`;
			}
		};
	};
	function en_default() {
		return { localeError: error() };
	}
	var _a;
	var $ZodRegistry = class {
		constructor() {
			this._map = new WeakMap();
			this._idmap = new Map();
		}
		add(schema, ..._meta) {
			const meta = _meta[0];
			this._map.set(schema, meta);
			if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
			return this;
		}
		clear() {
			this._map = new WeakMap();
			this._idmap = new Map();
			return this;
		}
		remove(schema) {
			const meta = this._map.get(schema);
			if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
			this._map.delete(schema);
			return this;
		}
		get(schema) {
			const p = schema._zod.parent;
			if (p) {
				const pm = { ...this.get(p) ?? {} };
				delete pm.id;
				const f = {
					...pm,
					...this._map.get(schema)
				};
				return Object.keys(f).length ? f : void 0;
			}
			return this._map.get(schema);
		}
		has(schema) {
			return this._map.has(schema);
		}
	};
	function registry() {
		return new $ZodRegistry();
	}
	(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
	var globalRegistry = globalThis.__zod_globalRegistry;
	function snapshotChecks(def) {
		if (def.checks) def.checks = [...def.checks];
		return def;
	}
	function _string(Class, params) {
		return new Class(snapshotChecks({
			type: "string",
			...normalizeParams(params)
		}));
	}
	function _email(Class, params) {
		return new Class({
			type: "string",
			format: "email",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _guid(Class, params) {
		return new Class({
			type: "string",
			format: "guid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _uuid(Class, params) {
		return new Class({
			type: "string",
			format: "uuid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _uuidv4(Class, params) {
		return new Class({
			type: "string",
			format: "uuid",
			check: "string_format",
			abort: false,
			version: "v4",
			...normalizeParams(params)
		});
	}
	function _uuidv6(Class, params) {
		return new Class({
			type: "string",
			format: "uuid",
			check: "string_format",
			abort: false,
			version: "v6",
			...normalizeParams(params)
		});
	}
	function _uuidv7(Class, params) {
		return new Class({
			type: "string",
			format: "uuid",
			check: "string_format",
			abort: false,
			version: "v7",
			...normalizeParams(params)
		});
	}
	function _url(Class, params) {
		return new Class({
			type: "string",
			format: "url",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _emoji(Class, params) {
		return new Class({
			type: "string",
			format: "emoji",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _nanoid(Class, params) {
		return new Class({
			type: "string",
			format: "nanoid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _cuid(Class, params) {
		return new Class({
			type: "string",
			format: "cuid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _cuid2(Class, params) {
		return new Class({
			type: "string",
			format: "cuid2",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _ulid(Class, params) {
		return new Class({
			type: "string",
			format: "ulid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _xid(Class, params) {
		return new Class({
			type: "string",
			format: "xid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _ksuid(Class, params) {
		return new Class({
			type: "string",
			format: "ksuid",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _ipv4(Class, params) {
		return new Class({
			type: "string",
			format: "ipv4",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _ipv6(Class, params) {
		return new Class({
			type: "string",
			format: "ipv6",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _cidrv4(Class, params) {
		return new Class({
			type: "string",
			format: "cidrv4",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _cidrv6(Class, params) {
		return new Class({
			type: "string",
			format: "cidrv6",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _base64(Class, params) {
		return new Class({
			type: "string",
			format: "base64",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _base64url(Class, params) {
		return new Class({
			type: "string",
			format: "base64url",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _e164(Class, params) {
		return new Class({
			type: "string",
			format: "e164",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _jwt(Class, params) {
		return new Class({
			type: "string",
			format: "jwt",
			check: "string_format",
			abort: false,
			...normalizeParams(params)
		});
	}
	function _isoDateTime(Class, params) {
		return new Class({
			type: "string",
			format: "datetime",
			check: "string_format",
			offset: false,
			local: false,
			precision: null,
			...normalizeParams(params)
		});
	}
	function _isoDate(Class, params) {
		return new Class({
			type: "string",
			format: "date",
			check: "string_format",
			...normalizeParams(params)
		});
	}
	function _isoTime(Class, params) {
		return new Class({
			type: "string",
			format: "time",
			check: "string_format",
			precision: null,
			...normalizeParams(params)
		});
	}
	function _isoDuration(Class, params) {
		return new Class({
			type: "string",
			format: "duration",
			check: "string_format",
			...normalizeParams(params)
		});
	}
	function _number(Class, params) {
		return new Class(snapshotChecks({
			type: "number",
			checks: [],
			...normalizeParams(params)
		}));
	}
	function _int(Class, params) {
		return new Class({
			type: "number",
			check: "number_format",
			abort: false,
			format: "safeint",
			...normalizeParams(params)
		});
	}
	function _boolean(Class, params) {
		return new Class({
			type: "boolean",
			...normalizeParams(params)
		});
	}
	function _unknown(Class) {
		return new Class({ type: "unknown" });
	}
	function _never(Class, params) {
		return new Class({
			type: "never",
			...normalizeParams(params)
		});
	}
	function _lt(value, params) {
		return new $ZodCheckLessThan({
			check: "less_than",
			...normalizeParams(params),
			value,
			inclusive: false
		});
	}
	function _lte(value, params) {
		return new $ZodCheckLessThan({
			check: "less_than",
			...normalizeParams(params),
			value,
			inclusive: true
		});
	}
	function _gt(value, params) {
		return new $ZodCheckGreaterThan({
			check: "greater_than",
			...normalizeParams(params),
			value,
			inclusive: false
		});
	}
	function _gte(value, params) {
		return new $ZodCheckGreaterThan({
			check: "greater_than",
			...normalizeParams(params),
			value,
			inclusive: true
		});
	}
	function _multipleOf(value, params) {
		return new $ZodCheckMultipleOf({
			check: "multiple_of",
			...normalizeParams(params),
			value
		});
	}
	function _maxLength(maximum, params) {
		return new $ZodCheckMaxLength({
			check: "max_length",
			...normalizeParams(params),
			maximum
		});
	}
	function _minLength(minimum, params) {
		return new $ZodCheckMinLength({
			check: "min_length",
			...normalizeParams(params),
			minimum
		});
	}
	function _length(length, params) {
		return new $ZodCheckLengthEquals({
			check: "length_equals",
			...normalizeParams(params),
			length
		});
	}
	function _regex(pattern, params) {
		return new $ZodCheckRegex({
			check: "string_format",
			format: "regex",
			...normalizeParams(params),
			pattern
		});
	}
	function _lowercase(params) {
		return new $ZodCheckLowerCase({
			check: "string_format",
			format: "lowercase",
			...normalizeParams(params)
		});
	}
	function _uppercase(params) {
		return new $ZodCheckUpperCase({
			check: "string_format",
			format: "uppercase",
			...normalizeParams(params)
		});
	}
	function _includes(includes, params) {
		return new $ZodCheckIncludes({
			check: "string_format",
			format: "includes",
			...normalizeParams(params),
			includes
		});
	}
	function _startsWith(prefix, params) {
		return new $ZodCheckStartsWith({
			check: "string_format",
			format: "starts_with",
			...normalizeParams(params),
			prefix
		});
	}
	function _endsWith(suffix, params) {
		return new $ZodCheckEndsWith({
			check: "string_format",
			format: "ends_with",
			...normalizeParams(params),
			suffix
		});
	}
	function _overwrite(tx) {
		return new $ZodCheckOverwrite({
			check: "overwrite",
			tx
		});
	}
	function _normalize(form) {
		return _overwrite((input) => input.normalize(form));
	}
	function _trim() {
		return _overwrite((input) => input.trim());
	}
	function _toLowerCase() {
		return _overwrite((input) => input.toLowerCase());
	}
	function _toUpperCase() {
		return _overwrite((input) => input.toUpperCase());
	}
	function _slugify() {
		return _overwrite((input) => slugify(input));
	}
	function _array(Class, element, params) {
		return new Class({
			type: "array",
			element,
			...normalizeParams(params)
		});
	}
	function _refine(Class, fn, _params) {
		return new Class({
			type: "custom",
			check: "custom",
			fn,
			...normalizeParams(_params)
		});
	}
	function _superRefine(fn, params) {
		const ch = _check((payload) => {
			payload.addIssue = (issue$2) => {
				if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
				else {
					const _issue = issue$2;
					if (_issue.fatal) _issue.continue = false;
					_issue.code ?? (_issue.code = "custom");
					if (!("input" in _issue)) _issue.input = payload.value;
					_issue.inst ?? (_issue.inst = ch);
					_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
					payload.issues.push(issue(_issue));
				}
			};
			return fn(payload.value, payload);
		}, params);
		return ch;
	}
	function _check(fn, params) {
		const ch = new $ZodCheck({
			check: "custom",
			...normalizeParams(params)
		});
		ch._zod.check = fn;
		return ch;
	}
	function assignProps(target, ...sources) {
		for (const source of sources) for (const key of Reflect.ownKeys(source)) if (Object.prototype.propertyIsEnumerable.call(source, key)) assignProp(target, key, source[key]);
		return target;
	}
	function initializeContext(params) {
		let target = params?.target ?? "draft-2020-12";
		if (target === "draft-4") target = "draft-04";
		if (target === "draft-7") target = "draft-07";
		return {
			processors: params.processors ?? {},
			metadataRegistry: params?.metadata ?? globalRegistry,
			target,
			unrepresentable: params?.unrepresentable ?? "throw",
			override: params?.override ?? (() => {}),
			io: params?.io ?? "output",
			counter: 0,
			seen: new Map(),
			sharedDefsExtractedFor: void 0,
			sharedEmitDoneFor: void 0,
			cycles: params?.cycles ?? "ref",
			reused: params?.reused ?? "inline",
			intersections: [],
			deferred: [],
			external: params?.external ?? void 0
		};
	}
	function handleUnrepresentable(schema, ctx, json, params, message) {
		const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({
			zodSchema: schema,
			path: params.path,
			message
		}) : ctx.unrepresentable;
		if (result === "any") return false;
		if (result === void 0 || result === "throw") throw new Error(message);
		Object.assign(json, result);
		return true;
	}
	function processSchema(schema, ctx, _params = {
		path: [],
		schemaPath: []
	}) {
		var _a;
		const def = schema._zod.def;
		const seen = ctx.seen.get(schema);
		if (seen) {
			seen.count++;
			if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
			return seen.schema;
		}
		const result = {
			schema: {},
			count: 1,
			cycle: void 0,
			path: _params.path
		};
		ctx.seen.set(schema, result);
		ctx.sharedDefsExtractedFor = void 0;
		ctx.sharedEmitDoneFor = void 0;
		const overrideSchema = schema._zod.toJSONSchema?.();
		if (overrideSchema) result.schema = overrideSchema;
		else {
			const params = {
				..._params,
				schemaPath: [..._params.schemaPath, schema],
				path: _params.path
			};
			if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
			else {
				const _json = result.schema;
				const processor = ctx.processors[def.type];
				if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
				processor(schema, ctx, _json, params);
			}
			const parent = schema._zod.parent;
			if (parent) {
				if (!result.ref) result.ref = parent;
				processSchema(parent, ctx, params);
				ctx.seen.get(parent).isParent = true;
			}
		}
		const meta = ctx.metadataRegistry.get(schema);
		if (meta) assignProps(result.schema, meta);
		if (ctx.io === "input" && isTransforming(schema)) {
			delete result.schema.examples;
			delete result.schema.default;
		}
		if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
		delete result.schema._prefault;
		return ctx.seen.get(schema).schema;
	}
	function encodeJSONPointerSegment(segment) {
		return segment.replace(/~/g, "~0").replace(/\//g, "~1");
	}
	function extractDefs(ctx, schema) {
		const root = ctx.seen.get(schema);
		if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
		if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external) return;
		const idToSchema = new Map();
		for (const entry of ctx.seen.entries()) {
			const id = ctx.metadataRegistry.get(entry[0])?.id;
			if (id) {
				const existing = idToSchema.get(id);
				if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
				idToSchema.set(id, entry[0]);
			}
		}
		const makeURI = (entry) => {
			const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
			if (ctx.external) {
				const externalId = ctx.external.registry.get(entry[0])?.id;
				const uriGenerator = ctx.external.uri ?? ((id) => id);
				if (externalId) return { ref: uriGenerator(externalId) };
				const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
				entry[1].defId = id;
				return {
					defId: id,
					ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}`
				};
			}
			const uriPrefix = `#`;
			const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
			if (entry[1] === root && !entry[1].schema.id) return { ref: uriPrefix };
			const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
			return {
				defId,
				ref: defUriPrefix + encodeJSONPointerSegment(defId)
			};
		};
		const extractToDef = (entry) => {
			if (entry[1].schema.$ref) return;
			const seen = entry[1];
			const { ref, defId } = makeURI(entry);
			seen.def = { ...seen.schema };
			if (defId) seen.defId = defId;
			const schema = seen.schema;
			for (const key in schema) delete schema[key];
			schema.$ref = ref;
		};
		if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
			const seen = entry[1];
			if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
		}
		for (const entry of ctx.seen.entries()) {
			const seen = entry[1];
			if (schema === entry[0]) {
				extractToDef(entry);
				continue;
			}
			if (ctx.external) {
				const ext = ctx.external.registry.get(entry[0])?.id;
				if (schema !== entry[0] && ext) {
					extractToDef(entry);
					continue;
				}
			}
			if (ctx.metadataRegistry.get(entry[0])?.id) {
				extractToDef(entry);
				continue;
			}
			if (seen.cycle) {
				extractToDef(entry);
				continue;
			}
			if (seen.count > 1) {
				if (ctx.reused === "ref") extractToDef(entry);
			}
		}
		if (ctx.external) ctx.sharedDefsExtractedFor = ctx.external;
	}
	function compactTypeUnion(schema) {
		const options = schema.anyOf;
		if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0) return;
		const types = [];
		for (const option of options) {
			if (!option || typeof option !== "object") return;
			compactTypeUnion(option);
			const keys = Object.keys(option);
			if (keys.length !== 1 || keys[0] !== "type") return;
			const type = option.type;
			for (const member of Array.isArray(type) ? type : [type]) {
				if (typeof member !== "string") return;
				if (!types.includes(member)) types.push(member);
			}
		}
		delete schema.anyOf;
		schema.type = types.length === 1 ? types[0] : types;
	}
	var FOLDABLE_KEYS = new Set([
		"type",
		"properties",
		"required",
		"additionalProperties"
	]);
	var UNION_KEYS = ["oneOf", "anyOf"];
	function undeclaredConstraint(member) {
		const extra = member.additionalProperties;
		if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null) return null;
		return Object.keys(extra).length ? extra : null;
	}
	function foldObjects(members) {
		const objects = [];
		for (const member of members) {
			if (typeof member !== "object" || member.type !== "object") return null;
			for (const key in member) if (!FOLDABLE_KEYS.has(key)) return null;
			objects.push(member);
		}
		const properties = {};
		const required = new Set();
		for (const object of objects) {
			for (const key in object.properties) {
				if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
				const parts = [];
				for (const other of objects) {
					const part = other.properties?.[key] ?? undeclaredConstraint(other);
					if (part === null || part === void 0) continue;
					if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part))) parts.push(part);
				}
				assignProp(properties, key, parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts });
			}
			for (const key of object.required ?? []) required.add(key);
		}
		const folded = {
			type: "object",
			properties
		};
		if (required.size) folded.required = [...required];
		if (objects.every((object) => object.additionalProperties === false)) folded.additionalProperties = false;
		else {
			const constraints = [];
			for (const object of objects) {
				const constraint = undeclaredConstraint(object);
				if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint))) constraints.push(constraint);
			}
			if (constraints.length === 1) folded.additionalProperties = constraints[0];
			else if (constraints.length > 1) folded.additionalProperties = { allOf: constraints };
		}
		return folded;
	}
	function foldIntersection(json) {
		const allOf = json.allOf;
		if (!Array.isArray(allOf) || allOf.length < 2) return;
		for (const key of FOLDABLE_KEYS) if (key in json) return;
		const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
		let folded = null;
		if (!unions.length) folded = foldObjects(allOf);
		else {
			const union = unions[0];
			const keyword = UNION_KEYS.find((k) => Array.isArray(union[k]));
			if (Object.keys(union).length !== 1) return;
			const rest = allOf.filter((m) => m !== union);
			const branches = union[keyword].map((branch) => foldObjects([...rest, branch]));
			if (branches.some((b) => !b)) return;
			folded = { [keyword]: branches };
		}
		if (!folded) return;
		delete json.allOf;
		assignProps(json, folded);
	}
	function finalize(ctx, schema) {
		const root = ctx.seen.get(schema);
		if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
		const flattenRef = (zodSchema) => {
			const seen = ctx.seen.get(zodSchema);
			if (seen.ref === null) return;
			const schema = seen.def ?? seen.schema;
			const _cached = { ...schema };
			const ref = seen.ref;
			seen.ref = null;
			if (ref) {
				flattenRef(ref);
				const refSeen = ctx.seen.get(ref);
				const refSchema = refSeen.schema;
				if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
					schema.allOf = schema.allOf ?? [];
					schema.allOf.push(refSchema);
				} else assignProps(schema, refSchema);
				assignProps(schema, _cached);
				if (zodSchema._zod.parent === ref) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (!(key in _cached)) delete schema[key];
				}
				if (refSchema.$ref && refSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
				}
			}
			const parent = zodSchema._zod.parent;
			if (parent && parent !== ref) {
				flattenRef(parent);
				const parentSeen = ctx.seen.get(parent);
				if (parentSeen?.schema.$ref) {
					schema.$ref = parentSeen.schema.$ref;
					if (parentSeen.def) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
					}
				}
			}
			ctx.override({
				zodSchema,
				jsonSchema: schema,
				path: seen.path ?? []
			});
		};
		if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
			for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
			if (ctx.target !== "openapi-3.0") for (const entry of ctx.seen.entries()) compactTypeUnion(entry[1].def ?? entry[1].schema);
			for (const rewrite of ctx.deferred) rewrite();
			if (ctx.intersections.length) {
				const carriers = new Map();
				for (const seen of ctx.seen.values()) for (const json of [seen.schema, seen.def]) {
					const allOf = json?.allOf;
					if (!Array.isArray(allOf)) continue;
					const existing = carriers.get(allOf);
					if (existing) existing.push(json);
					else carriers.set(allOf, [json]);
				}
				for (const allOf of ctx.intersections) for (const json of carriers.get(allOf) ?? []) foldIntersection(json);
			}
		}
		const result = {};
		if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
		else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
		else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
		else if (ctx.target === "openapi-3.0") {}
		if (ctx.external?.uri) {
			const id = ctx.external.registry.get(schema)?.id;
			if (!id) throw new Error("Schema is missing an `id` property");
			result.$id = ctx.external.uri(id);
		}
		assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
		const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
		if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
		const defs = ctx.external?.defs ?? {};
		if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) for (const entry of ctx.seen.entries()) {
			const seen = entry[1];
			if (seen.def && seen.defId) {
				if (seen.def.id === seen.defId) delete seen.def.id;
				assignProp(defs, seen.defId, seen.def);
			}
		}
		if (ctx.external) ctx.sharedEmitDoneFor = ctx.external;
		if (ctx.external) {} else if (Object.keys(defs).length > 0) {
			if (ctx.target === "draft-2020-12") result.$defs = defs;
			else result.definitions = defs;
		}
		try {
			const finalized = JSON.parse(JSON.stringify(result));
			Object.defineProperty(finalized, "~standard", {
				value: {
					...schema["~standard"],
					jsonSchema: {
						input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
						output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
					}
				},
				enumerable: false,
				writable: false
			});
			return finalized;
		} catch (_err) {
			throw new Error("Error converting schema to JSON.");
		}
	}
	function isTransforming(_schema, _ctx) {
		const ctx = _ctx ?? { seen: new Set() };
		if (ctx.seen.has(_schema)) return false;
		ctx.seen.add(_schema);
		const def = _schema._zod.def;
		if (def.type === "transform") return true;
		if (def.type === "array") return isTransforming(def.element, ctx);
		if (def.type === "set") return isTransforming(def.valueType, ctx);
		if (def.type === "lazy") return isTransforming(def.getter(), ctx);
		if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") return isTransforming(def.innerType, ctx);
		if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
		if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
		if (def.type === "pipe") {
			if (_schema._zod.traits.has("$ZodCodec")) return true;
			return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
		}
		if (def.type === "object") {
			for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
			return false;
		}
		if (def.type === "union") {
			for (const option of def.options) if (isTransforming(option, ctx)) return true;
			return false;
		}
		if (def.type === "tuple") {
			for (const item of def.items) if (isTransforming(item, ctx)) return true;
			if (def.rest && isTransforming(def.rest, ctx)) return true;
			return false;
		}
		return false;
	}
	var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
		const ctx = initializeContext({
			...params,
			processors
		});
		processSchema(schema, ctx);
		extractDefs(ctx, schema);
		return finalize(ctx, schema);
	};
	var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
		const { libraryOptions, target } = params ?? {};
		const ctx = initializeContext({
			...libraryOptions ?? {},
			target,
			io,
			processors
		});
		processSchema(schema, ctx);
		extractDefs(ctx, schema);
		return finalize(ctx, schema);
	};
	var narrowMin = (agg, key, value) => {
		if (agg[key] === void 0 || value > agg[key]) agg[key] = value;
	};
	var narrowMax = (agg, key, value) => {
		if (agg[key] === void 0 || value < agg[key]) agg[key] = value;
	};
	var narrowBoth = (agg, value) => {
		narrowMin(agg, "minimum", value);
		narrowMax(agg, "maximum", value);
	};
	var addDivisor = (agg, value) => {
		agg.multipleOf ?? (agg.multipleOf = []);
		if (!agg.multipleOf.includes(value)) agg.multipleOf.push(value);
	};
	var addPattern = (agg, pattern) => {
		agg.patterns ?? (agg.patterns = new Set());
		agg.patterns.add(pattern);
	};
	var intersectMime = (agg, mime) => {
		agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
	};
	var setFormat = (agg, format) => {
		agg.format = format;
		if (format.includes("int")) agg.isInt = true;
	};
	var minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
	var maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
	var formatContributor = (ranges) => (agg, def) => {
		setFormat(agg, def.format);
		const [minimum, maximum] = ranges[def.format];
		narrowMin(agg, "minimum", minimum);
		narrowMax(agg, "maximum", maximum);
	};
	var contributors = {
		greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
		less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
		multiple_of: (agg, def) => addDivisor(agg, def.value),
		number_format: formatContributor(NUMBER_FORMAT_RANGES),
		bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
		min_length: minContributor,
		max_length: maxContributor,
		length_equals: (agg, def) => narrowBoth(agg, def.length),
		min_size: minContributor,
		max_size: maxContributor,
		size_equals: (agg, def) => narrowBoth(agg, def.size),
		string_format: (agg, def) => {
			setFormat(agg, def.format);
			if (def.pattern) addPattern(agg, def.pattern);
			if (def.format === "base64" || def.format === "base64url") agg.contentEncoding = def.format;
			if (def.local || def.precision === -1) agg.laxFormat = true;
		},
		mime_type: (agg, def) => intersectMime(agg, def.mime)
	};
	function aggregateChecks(schema) {
		const agg = {};
		const def = schema._zod.def;
		const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
		for (const ch of list) contributors[ch._zod.def.check]?.(agg, ch._zod.def);
		const bag = schema._zod.bag;
		if (bag.minimum !== void 0) narrowMin(agg, "minimum", bag.minimum);
		if (bag.exclusiveMinimum !== void 0) narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
		if (bag.maximum !== void 0) narrowMax(agg, "maximum", bag.maximum);
		if (bag.exclusiveMaximum !== void 0) narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
		if (bag.multipleOf !== void 0) addDivisor(agg, bag.multipleOf);
		if (bag.format !== void 0) {
			agg.format ?? (agg.format = bag.format);
			if (bag.format.includes("int")) agg.isInt = true;
		}
		if (bag.mime) intersectMime(agg, bag.mime);
		for (const pattern of bag.patterns ?? []) addPattern(agg, pattern);
		return agg;
	}
	var formatMap = {
		guid: "uuid",
		url: "uri",
		datetime: "date-time",
		json_string: "json-string",
		regex: ""
	};
	var exactPatterns = new Map([[base64Charset, base64], [base64urlCharset, base64url]]);
	var exactPattern = (p) => exactPatterns.get(p) ?? p;
	var stringProcessor = (schema, ctx, _json, _params) => {
		const json = _json;
		json.type = "string";
		const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
		if (typeof minimum === "number") json.minLength = minimum;
		if (typeof maximum === "number") json.maxLength = maximum;
		if (format) {
			json.format = formatMap[format] ?? format;
			if (json.format === "") delete json.format;
			if (format === "time" || laxFormat) delete json.format;
		}
		if (contentEncoding) json.contentEncoding = contentEncoding;
		if (patterns && patterns.size > 0) {
			const patternList = [...patterns].map(exactPattern);
			if (patternList.length === 1) json.pattern = patternList[0].source;
			else if (patternList.length > 1) json.allOf = [...patternList.map((regex) => ({
				...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
				pattern: regex.source
			}))];
		}
	};
	var numberProcessor = (schema, ctx, _json, params) => {
		const json = _json;
		const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
		json.type = isInt ? "integer" : "number";
		const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
		const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
		const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
		if (exMin) {
			if (legacy) {
				json.minimum = exclusiveMinimum;
				json.exclusiveMinimum = true;
			} else json.exclusiveMinimum = exclusiveMinimum;
		} else if (typeof minimum === "number") json.minimum = minimum;
		if (exMax) {
			if (legacy) {
				json.maximum = exclusiveMaximum;
				json.exclusiveMaximum = true;
			} else json.exclusiveMaximum = exclusiveMaximum;
		} else if (typeof maximum === "number") json.maximum = maximum;
		if (multipleOf) {
			const divisors = new Set();
			for (const divisor of multipleOf) if (Number.isFinite(divisor) && divisor !== 0) divisors.add(Math.abs(divisor));
			else handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
			const [first, ...rest] = divisors;
			if (first !== void 0) json.multipleOf = first;
			if (rest.length) json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
		}
	};
	var booleanProcessor = (_schema, _ctx, json, _params) => {
		json.type = "boolean";
	};
	var neverProcessor = (_schema, _ctx, json, _params) => {
		json.not = {};
	};
	var enumProcessor = (schema, _ctx, json, _params) => {
		const def = schema._zod.def;
		const values = getEnumValues(def.entries);
		if (values.length === 0) {
			json.not = {};
			return;
		}
		if (values.every((v) => typeof v === "number")) json.type = "number";
		if (values.every((v) => typeof v === "string")) json.type = "string";
		json.enum = values;
	};
	var customProcessor = (schema, ctx, json, params) => {
		handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
	};
	var transformProcessor = (schema, ctx, json, params) => {
		handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
	};
	var arrayProcessor = (schema, ctx, _json, params) => {
		const json = _json;
		const def = schema._zod.def;
		const { minimum, maximum } = aggregateChecks(schema);
		if (typeof minimum === "number") json.minItems = minimum;
		if (typeof maximum === "number") json.maxItems = maximum;
		json.type = "array";
		json.items = processSchema(def.element, ctx, {
			...params,
			path: [...params.path, "items"]
		});
	};
	function inputOptin(schema) {
		const def = schema._zod.def;
		if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) return inputOptin(def.out);
		if (def.type === "catch") return inputOptin(def.innerType);
		return schema._zod.optin;
	}
	var objectProcessor = (schema, ctx, _json, params) => {
		const json = _json;
		const def = schema._zod.def;
		const shape = def.shape;
		if (Object.getOwnPropertySymbols(shape).length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) return;
		json.type = "object";
		json.properties = {};
		for (const key in shape) assignProp(json.properties, key, processSchema(shape[key], ctx, {
			...params,
			path: [
				...params.path,
				"properties",
				key
			]
		}));
		const requiredKeys = [];
		for (const key of Object.keys(shape)) {
			const field = def.shape[key];
			if (ctx.io === "input" ? inputOptin(field) === void 0 : field._zod.optout === void 0) requiredKeys.push(key);
		}
		if (requiredKeys.length > 0) json.required = requiredKeys;
		if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
		else if (!def.catchall) {
			if (ctx.io === "output") json.additionalProperties = false;
		} else if (def.catchall) json.additionalProperties = processSchema(def.catchall, ctx, {
			...params,
			path: [...params.path, "additionalProperties"]
		});
	};
	var unionProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		const isExclusive = def.inclusive === false;
		const options = def.options.map((x, i) => processSchema(x, ctx, {
			...params,
			path: [
				...params.path,
				isExclusive ? "oneOf" : "anyOf",
				i
			]
		}));
		if (isExclusive) json.oneOf = options;
		else json.anyOf = options;
	};
	var intersectionProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		const a = processSchema(def.left, ctx, {
			...params,
			path: [
				...params.path,
				"allOf",
				0
			]
		});
		const b = processSchema(def.right, ctx, {
			...params,
			path: [
				...params.path,
				"allOf",
				1
			]
		});
		const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
		const allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
		json.allOf = allOf;
		ctx.intersections.push(allOf);
	};
	var nullableProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		const inner = processSchema(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		if (ctx.target === "openapi-3.0") {
			seen.ref = def.innerType;
			json.nullable = true;
		} else json.anyOf = [inner, { type: "null" }];
	};
	var nonoptionalProcessor = (schema, ctx, _json, params) => {
		const def = schema._zod.def;
		processSchema(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
	};
	var UNREPRESENTABLE_DEFAULT = Symbol();
	function serializeDefaultValue(value, schema, ctx, json, params) {
		let unrepresentable = false;
		const serialized = JSON.stringify(value, (_, val) => {
			if (typeof val !== "bigint") return val;
			unrepresentable = true;
			return null;
		});
		if (!unrepresentable) return JSON.parse(serialized);
		handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
		return UNREPRESENTABLE_DEFAULT;
	}
	var defaultProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		processSchema(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
		const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
		if (value !== UNREPRESENTABLE_DEFAULT) json.default = value;
	};
	var prefaultProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		processSchema(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
		if (ctx.io !== "input") return;
		const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
		if (value !== UNREPRESENTABLE_DEFAULT) json._prefault = value;
	};
	var catchProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		processSchema(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
		let catchValue;
		try {
			catchValue = def.catchValue(void 0);
		} catch {
			handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
			return;
		}
		json.default = catchValue;
	};
	var pipeProcessor = (schema, ctx, _json, params) => {
		const def = schema._zod.def;
		const inIsTransform = def.in._zod.traits.has("$ZodTransform");
		const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
		processSchema(innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = innerType;
	};
	var readonlyProcessor = (schema, ctx, json, params) => {
		const def = schema._zod.def;
		processSchema(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
		json.readOnly = true;
	};
	var optionalProcessor = (schema, ctx, _json, params) => {
		const def = schema._zod.def;
		processSchema(def.innerType, ctx, params);
		const seen = ctx.seen.get(schema);
		seen.ref = def.innerType;
	};
	var _installedErrorProtos = new WeakSet([Object.prototype, Error.prototype]);
	function _lazyMethod(proto, key, make) {
		Object.defineProperty(proto, key, {
			configurable: true,
			enumerable: false,
			get() {
				const value = make(this);
				Object.defineProperty(this, key, {
					value,
					configurable: true,
					writable: true
				});
				return value;
			},
			set(value) {
				Object.defineProperty(this, key, {
					value,
					configurable: true,
					writable: true
				});
			}
		});
	}
	var initializer = (inst, issues) => {
		$ZodError.init(inst, issues);
		inst.name = "ZodError";
		const proto = Object.getPrototypeOf(inst);
		if (_installedErrorProtos.has(proto)) return;
		_installedErrorProtos.add(proto);
		_lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
		_lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
		_lazyMethod(proto, "addIssue", (self) => (issue) => {
			self.issues.push(issue);
			self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
		});
		_lazyMethod(proto, "addIssues", (self) => (issues) => {
			self.issues.push(...issues);
			self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
		});
		Object.defineProperty(proto, "isEmpty", {
			configurable: true,
			enumerable: false,
			get() {
				return this.issues.length === 0;
			}
		});
	};
	var ZodRealError = $constructor("ZodError", initializer, void 0, { Parent: Error });
	var parse = _parse(ZodRealError);
	var parseAsync = _parseAsync(ZodRealError);
	var safeParse = _safeParse(ZodRealError);
	var safeParseAsync = _safeParseAsync(ZodRealError);
	var encode = _encode(ZodRealError);
	var decode = _decode(ZodRealError);
	var encodeAsync = _encodeAsync(ZodRealError);
	var decodeAsync = _decodeAsync(ZodRealError);
	var safeEncode = _safeEncode(ZodRealError);
	var safeDecode = _safeDecode(ZodRealError);
	var safeEncodeAsync = _safeEncodeAsync(ZodRealError);
	var safeDecodeAsync = _safeDecodeAsync(ZodRealError);
	function _ensureDefaultLocale() {
		if (!globalConfig.localeError) config(en_default());
	}
	function _ensureDefaultMemoizer() {
		if (!globalConfig.memoizer) config({ memoizer: memoizer() });
	}
	var ZodType = $constructor("ZodType", (inst, def) => {
		_ensureDefaultLocale();
		$ZodType.init(inst, def);
		inst.def = def;
		inst.type = def.type;
		return inst;
	}, {
		check(...chks) {
			const def = this.def;
			return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
				check: ch,
				def: { check: "custom" },
				onattach: []
			} } : ch)] }), { parent: true });
		},
		with(...chks) {
			return this.check(...chks);
		},
		clone(def, params) {
			return clone(this, def, params);
		},
		brand() {
			return this;
		},
		register(reg, meta) {
			reg.add(this, meta);
			return this;
		},
		refine(check, params) {
			return this.check(refine(check, params));
		},
		superRefine(refinement, params) {
			return this.check(superRefine(refinement, params));
		},
		overwrite(fn) {
			return this.check(_overwrite(fn));
		},
		optional() {
			return optional(this);
		},
		exactOptional() {
			return exactOptional(this);
		},
		nullable() {
			return nullable(this);
		},
		nullish() {
			return optional(nullable(this));
		},
		nonoptional(params) {
			return nonoptional(this, params);
		},
		array() {
			return array(this);
		},
		or(arg) {
			return union([this, arg]);
		},
		and(arg) {
			return intersection(this, arg);
		},
		transform(tx) {
			return pipe(this, transform(tx));
		},
		default(d) {
			return _default(this, d);
		},
		prefault(d) {
			return prefault(this, d);
		},
		catch(params) {
			return _catch(this, params);
		},
		pipe(target) {
			return pipe(this, target);
		},
		readonly() {
			return readonly(this);
		},
		describe(description) {
			const cl = this.clone();
			globalRegistry.add(cl, { description });
			return cl;
		},
		meta(...args) {
			if (args.length === 0) return globalRegistry.get(this);
			const cl = this.clone();
			globalRegistry.add(cl, args[0]);
			return cl;
		},
		isOptional() {
			return this.safeParse(void 0).success;
		},
		isNullable() {
			return this.safeParse(null).success;
		},
		apply(fn, ...args) {
			return args.length === 0 ? fn(this) : fn(this, ...args);
		},
		get "~standard"() {
			return hide(this, "~standard", {
				...standardProps(this),
				jsonSchema: {
					input: createStandardJSONSchemaMethod(this, "input"),
					output: createStandardJSONSchemaMethod(this, "output")
				}
			});
		},
		set "~standard"(value) {
			own(this, "~standard", value);
		},
		parse: function _parse(data, params) {
			return parse(this, data, params, { callee: _parse });
		},
		parseAsync: async function _parseAsync(data, params) {
			return await parseAsync(this, data, params, { callee: _parseAsync });
		},
		safeParse(data, params) {
			return safeParse(this, data, params);
		},
		async safeParseAsync(data, params) {
			return safeParseAsync(this, data, params);
		},
		get spa() {
			return this?.safeParseAsync;
		},
		set spa(value) {
			own(this, "spa", value);
		},
		validate(data, params) {
			return validate(this, data, params);
		},
		validateAsync(data, params) {
			return validateAsync$1(this, data, params);
		},
		encode: function _encode(data, params) {
			return encode(this, data, params, { callee: _encode });
		},
		decode: function _decode(data, params) {
			return decode(this, data, params, { callee: _decode });
		},
		encodeAsync: async function _encodeAsync(data, params) {
			return await encodeAsync(this, data, params, { callee: _encodeAsync });
		},
		decodeAsync: async function _decodeAsync(data, params) {
			return await decodeAsync(this, data, params, { callee: _decodeAsync });
		},
		safeEncode(data, params) {
			return safeEncode(this, data, params);
		},
		safeDecode(data, params) {
			return safeDecode(this, data, params);
		},
		async safeEncodeAsync(data, params) {
			return safeEncodeAsync(this, data, params);
		},
		async safeDecodeAsync(data, params) {
			return safeDecodeAsync(this, data, params);
		},
		toJSONSchema(params) {
			return createToJSONSchemaMethod(this, {})(params);
		},
		get description() {
			return globalRegistry.get(this)?.description;
		},
		get _def() {
			return this._zod.def;
		}
	});
	var _ZodString = $constructor("_ZodString", (inst, def) => {
		$ZodString.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
	}, derived({
		format: (inst) => aggregateChecks(inst).format ?? null,
		minLength: (inst) => aggregateChecks(inst).minimum ?? null,
		maxLength: (inst) => aggregateChecks(inst).maximum ?? null
	}, {
		regex(...args) {
			return this.check(_regex(...args));
		},
		includes(...args) {
			return this.check(_includes(...args));
		},
		startsWith(...args) {
			return this.check(_startsWith(...args));
		},
		endsWith(...args) {
			return this.check(_endsWith(...args));
		},
		min(...args) {
			return this.check(_minLength(...args));
		},
		max(...args) {
			return this.check(_maxLength(...args));
		},
		length(...args) {
			return this.check(_length(...args));
		},
		nonempty(...args) {
			return this.check(_minLength(1, ...args));
		},
		lowercase(params) {
			return this.check(_lowercase(params));
		},
		uppercase(params) {
			return this.check(_uppercase(params));
		},
		trim() {
			return this.check(_trim());
		},
		normalize(...args) {
			return this.check(_normalize(...args));
		},
		toLowerCase() {
			return this.check(_toLowerCase());
		},
		toUpperCase() {
			return this.check(_toUpperCase());
		},
		slugify() {
			return this.check(_slugify());
		}
	}));
	var ZodString = $constructor("ZodString", (inst, def) => {
		$ZodString.init(inst, def);
		_ZodString.init(inst, def);
	}, {
		email(params) {
			return this.check(_email(ZodEmail, params));
		},
		url(params) {
			return this.check(_url(ZodURL, params));
		},
		jwt(params) {
			return this.check(_jwt(ZodJWT, params));
		},
		emoji(params) {
			return this.check(_emoji(ZodEmoji, params));
		},
		guid(params) {
			return this.check(_guid(ZodGUID, params));
		},
		uuid(params) {
			return this.check(_uuid(ZodUUID, params));
		},
		uuidv4(params) {
			return this.check(_uuidv4(ZodUUID, params));
		},
		uuidv6(params) {
			return this.check(_uuidv6(ZodUUID, params));
		},
		uuidv7(params) {
			return this.check(_uuidv7(ZodUUID, params));
		},
		nanoid(params) {
			return this.check(_nanoid(ZodNanoID, params));
		},
		cuid(params) {
			return this.check(_cuid(ZodCUID, params));
		},
		cuid2(params) {
			return this.check(_cuid2(ZodCUID2, params));
		},
		ulid(params) {
			return this.check(_ulid(ZodULID, params));
		},
		base64(params) {
			return this.check(_base64(ZodBase64, params));
		},
		base64url(params) {
			return this.check(_base64url(ZodBase64URL, params));
		},
		xid(params) {
			return this.check(_xid(ZodXID, params));
		},
		ksuid(params) {
			return this.check(_ksuid(ZodKSUID, params));
		},
		ipv4(params) {
			return this.check(_ipv4(ZodIPv4, params));
		},
		ipv6(params) {
			return this.check(_ipv6(ZodIPv6, params));
		},
		cidrv4(params) {
			return this.check(_cidrv4(ZodCIDRv4, params));
		},
		cidrv6(params) {
			return this.check(_cidrv6(ZodCIDRv6, params));
		},
		e164(params) {
			return this.check(_e164(ZodE164, params));
		},
		datetime(params) {
			return this.check(_isoDateTime(ZodISODateTime, params));
		},
		date(params) {
			return this.check(_isoDate(ZodISODate, params));
		},
		time(params) {
			return this.check(_isoTime(ZodISOTime, params));
		},
		duration(params) {
			return this.check(_isoDuration(ZodISODuration, params));
		}
	});
	function string(params) {
		return _string(ZodString, params);
	}
	var ZodStringFormat = $constructor("ZodStringFormat", (inst, def) => {
		$ZodStringFormat.init(inst, def);
		_ZodString.init(inst, def);
	});
	var ZodISODateTime = $constructor("ZodISODateTime", (inst, def) => {
		$ZodISODateTime.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodISODate = $constructor("ZodISODate", (inst, def) => {
		$ZodISODate.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodISOTime = $constructor("ZodISOTime", (inst, def) => {
		$ZodISOTime.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodISODuration = $constructor("ZodISODuration", (inst, def) => {
		$ZodISODuration.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodEmail = $constructor("ZodEmail", (inst, def) => {
		$ZodEmail.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodGUID = $constructor("ZodGUID", (inst, def) => {
		$ZodGUID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodUUID = $constructor("ZodUUID", (inst, def) => {
		$ZodUUID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodURL = $constructor("ZodURL", (inst, def) => {
		$ZodURL.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodEmoji = $constructor("ZodEmoji", (inst, def) => {
		$ZodEmoji.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodNanoID = $constructor("ZodNanoID", (inst, def) => {
		$ZodNanoID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodCUID = $constructor("ZodCUID", (inst, def) => {
		$ZodCUID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodCUID2 = $constructor("ZodCUID2", (inst, def) => {
		$ZodCUID2.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodULID = $constructor("ZodULID", (inst, def) => {
		$ZodULID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodXID = $constructor("ZodXID", (inst, def) => {
		$ZodXID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodKSUID = $constructor("ZodKSUID", (inst, def) => {
		$ZodKSUID.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodIPv4 = $constructor("ZodIPv4", (inst, def) => {
		$ZodIPv4.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodIPv6 = $constructor("ZodIPv6", (inst, def) => {
		$ZodIPv6.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodCIDRv4 = $constructor("ZodCIDRv4", (inst, def) => {
		$ZodCIDRv4.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodCIDRv6 = $constructor("ZodCIDRv6", (inst, def) => {
		$ZodCIDRv6.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodBase64 = $constructor("ZodBase64", (inst, def) => {
		$ZodBase64.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodBase64URL = $constructor("ZodBase64URL", (inst, def) => {
		$ZodBase64URL.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodE164 = $constructor("ZodE164", (inst, def) => {
		$ZodE164.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodJWT = $constructor("ZodJWT", (inst, def) => {
		$ZodJWT.init(inst, def);
		ZodStringFormat.init(inst, def);
	});
	var ZodNumber = $constructor("ZodNumber", (inst, def) => {
		$ZodNumber.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
		inst.isFinite = true;
	}, derived({
		minValue: (inst) => {
			const { minimum, exclusiveMinimum } = aggregateChecks(inst);
			return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
		},
		maxValue: (inst) => {
			const { maximum, exclusiveMaximum } = aggregateChecks(inst);
			return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
		},
		isInt: (inst) => {
			const { isInt, multipleOf } = aggregateChecks(inst);
			return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
		},
		format: (inst) => aggregateChecks(inst).format ?? null
	}, {
		gt(value, params) {
			return this.check(_gt(value, params));
		},
		gte(value, params) {
			return this.check(_gte(value, params));
		},
		min(value, params) {
			return this.check(_gte(value, params));
		},
		lt(value, params) {
			return this.check(_lt(value, params));
		},
		lte(value, params) {
			return this.check(_lte(value, params));
		},
		max(value, params) {
			return this.check(_lte(value, params));
		},
		int(params) {
			return this.check(int(params));
		},
		safe(params) {
			return this.check(int(params));
		},
		positive(params) {
			return this.check(_gt(0, params));
		},
		nonnegative(params) {
			return this.check(_gte(0, params));
		},
		negative(params) {
			return this.check(_lt(0, params));
		},
		nonpositive(params) {
			return this.check(_lte(0, params));
		},
		multipleOf(value, params) {
			return this.check(_multipleOf(value, params));
		},
		step(value, params) {
			return this.check(_multipleOf(value, params));
		},
		finite() {
			return this;
		}
	}));
	function number(params) {
		return _number(ZodNumber, params);
	}
	var ZodNumberFormat = $constructor("ZodNumberFormat", (inst, def) => {
		$ZodNumberFormat.init(inst, def);
		ZodNumber.init(inst, def);
	});
	function int(params) {
		return _int(ZodNumberFormat, params);
	}
	var ZodBoolean = $constructor("ZodBoolean", (inst, def) => {
		$ZodBoolean.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
	});
	function boolean(params) {
		return _boolean(ZodBoolean, params);
	}
	var ZodUnknown = $constructor("ZodUnknown", (inst, def) => {
		$ZodUnknown.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => void 0;
	});
	function unknown() {
		return _unknown(ZodUnknown);
	}
	var ZodNever = $constructor("ZodNever", (inst, def) => {
		$ZodNever.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
	});
	function never(params) {
		return _never(ZodNever, params);
	}
	var ZodArray = $constructor("ZodArray", (inst, def) => {
		_ensureDefaultMemoizer();
		$ZodArray.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
		inst.element = def.element;
	}, {
		min(n, params) {
			return this.check(_minLength(n, params));
		},
		nonempty(params) {
			return this.check(_minLength(1, params));
		},
		max(n, params) {
			return this.check(_maxLength(n, params));
		},
		length(n, params) {
			return this.check(_length(n, params));
		},
		unwrap() {
			return this.element;
		}
	});
	function array(element, params) {
		return _array(ZodArray, element, params);
	}
	var ZodObject = $constructor("ZodObject", (inst, def) => {
		_ensureDefaultMemoizer();
		$ZodObjectJIT.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
		installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
	}, {
		keyof() {
			return _enum(Object.keys(this._zod.def.shape));
		},
		catchall(catchall) {
			return this.clone(mergeDefs(this._zod.def, { catchall }));
		},
		passthrough() {
			return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
		},
		loose() {
			return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
		},
		strict() {
			return this.clone(mergeDefs(this._zod.def, { catchall: never() }));
		},
		strip() {
			return this.clone(mergeDefs(this._zod.def, { catchall: void 0 }));
		},
		extend(incoming) {
			return extend(this, incoming);
		},
		safeExtend(incoming) {
			return safeExtend(this, incoming);
		},
		merge(other) {
			return merge(this, other);
		},
		pick(mask) {
			return pick(this, mask);
		},
		omit(mask) {
			return omit(this, mask);
		},
		partial(...args) {
			return partial(ZodOptional, this, args[0]);
		},
		exactPartial(...args) {
			return partial(ZodExactOptional, this, args[0], "exactPartial");
		},
		required(...args) {
			return required(ZodNonOptional, this, args[0]);
		}
	});
	function object(shape, params) {
		return new ZodObject({
			type: "object",
			shape: shape ?? {},
			...normalizeParams(params)
		});
	}
	var ZodUnion = $constructor("ZodUnion", (inst, def) => {
		$ZodUnion.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
		inst.options = def.options;
	});
	function union(options, params) {
		return new ZodUnion({
			type: "union",
			options,
			...normalizeParams(params)
		});
	}
	var ZodIntersection = $constructor("ZodIntersection", (inst, def) => {
		$ZodIntersection.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
	});
	function intersection(left, right) {
		return new ZodIntersection({
			type: "intersection",
			left,
			right
		});
	}
	var ZodEnum = $constructor("ZodEnum", (inst, def) => {
		$ZodEnum.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
		inst.enum = def.entries;
		inst.options = [...inst._zod.values];
		const keys = new Set(Object.keys(def.entries));
		inst.extract = (values, params) => {
			const newEntries = {};
			for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
			else throw new Error(`Key ${value} not found in enum`);
			return new ZodEnum({
				...def,
				checks: [],
				...normalizeParams(params),
				entries: newEntries
			});
		};
		inst.exclude = (values, params) => {
			const newEntries = { ...def.entries };
			for (const value of values) if (keys.has(value)) delete newEntries[value];
			else throw new Error(`Key ${value} not found in enum`);
			return new ZodEnum({
				...def,
				checks: [],
				...normalizeParams(params),
				entries: newEntries
			});
		};
	});
	function _enum(values, params) {
		return new ZodEnum({
			type: "enum",
			entries: Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values,
			...normalizeParams(params)
		});
	}
	var ZodTransform = $constructor("ZodTransform", (inst, def) => {
		_ensureDefaultMemoizer();
		$ZodTransform.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
		inst._zod.parse = (payload, _ctx) => {
			if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
			payload.addIssue = (issue$1) => {
				if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
				else {
					const _issue = issue$1;
					if (_issue.fatal) _issue.continue = false;
					_issue.code ?? (_issue.code = "custom");
					if (!("input" in _issue)) _issue.input = payload.value;
					_issue.inst ?? (_issue.inst = inst);
					payload.issues.push(issue(_issue));
				}
			};
			const output = def.transform(payload.value, payload);
			if (output instanceof Promise) return output.then((output) => {
				payload.value = output;
				return payload;
			});
			payload.value = output;
			return payload;
		};
	});
	function transform(fn) {
		return new ZodTransform({
			type: "transform",
			transform: fn
		});
	}
	var ZodOptional = $constructor("ZodOptional", (inst, def) => {
		$ZodOptional.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function optional(innerType) {
		return new ZodOptional({
			type: "optional",
			innerType
		});
	}
	var ZodExactOptional = $constructor("ZodExactOptional", (inst, def) => {
		$ZodExactOptional.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function exactOptional(innerType) {
		return new ZodExactOptional({
			type: "optional",
			innerType
		});
	}
	var ZodNullable = $constructor("ZodNullable", (inst, def) => {
		$ZodNullable.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function nullable(innerType) {
		return new ZodNullable({
			type: "nullable",
			innerType
		});
	}
	var ZodDefault = $constructor("ZodDefault", (inst, def) => {
		$ZodDefault.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
		inst.removeDefault = inst.unwrap;
	});
	function _default(innerType, defaultValue) {
		return new ZodDefault({
			type: "default",
			innerType,
			get defaultValue() {
				return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
			}
		});
	}
	var ZodPrefault = $constructor("ZodPrefault", (inst, def) => {
		$ZodPrefault.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function prefault(innerType, defaultValue) {
		return new ZodPrefault({
			type: "prefault",
			innerType,
			get defaultValue() {
				return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
			}
		});
	}
	var ZodNonOptional = $constructor("ZodNonOptional", (inst, def) => {
		$ZodNonOptional.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function nonoptional(innerType, params) {
		return new ZodNonOptional({
			type: "nonoptional",
			innerType,
			...normalizeParams(params)
		});
	}
	var ZodCatch = $constructor("ZodCatch", (inst, def) => {
		$ZodCatch.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
		inst.removeCatch = inst.unwrap;
	});
	function _catch(innerType, catchValue) {
		return new ZodCatch({
			type: "catch",
			innerType,
			catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
		});
	}
	var ZodPipe = $constructor("ZodPipe", (inst, def) => {
		$ZodPipe.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
		inst.in = def.in;
		inst.out = def.out;
	});
	function pipe(in_, out) {
		return new ZodPipe({
			type: "pipe",
			in: in_,
			out
		});
	}
	var ZodReadonly = $constructor("ZodReadonly", (inst, def) => {
		$ZodReadonly.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
		inst.unwrap = () => inst._zod.def.innerType;
	});
	function readonly(innerType) {
		return new ZodReadonly({
			type: "readonly",
			innerType
		});
	}
	var ZodCustom = $constructor("ZodCustom", (inst, def) => {
		$ZodCustom.init(inst, def);
		ZodType.init(inst, def);
		inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
	});
	function refine(fn, _params = {}) {
		return _refine(ZodCustom, fn, _params);
	}
	function superRefine(fn, params) {
		return _superRefine(fn, params);
	}
	var ChartSnapshot = object({
		key: string(),
		ageSex: string().optional(),
		allergies: string().optional(),
		meds: string().optional(),
		rel: string().optional(),
		ts: number()
	}).passthrough();
	var cachedToken = "";
	var cachedDigits = "";
	function adoptFromTop() {
		try {
			if (window.top === window) return false;
			const t = window.top.__tmCore;
			const id = t && t._identity && t._identity();
			if (id && id.token) {
				cachedToken = id.token;
				cachedDigits = id.digits;
				return true;
			}
		} catch {}
		return false;
	}
	function scanHeader() {
		try {
			const els = document.querySelectorAll("span, div, h1, h2, h3, td, a, b, strong");
			for (let i = 0; i < els.length; i++) {
				const tx = (els[i].textContent || "").replace(/\s+/g, " ").trim();
				if (tx.length > 70 || tx.length < 5) continue;
				if (/^clinical\s/i.test(tx)) continue;
				const em = tx.match(/^[A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?\s*\(\s*([A-Za-z]{0,5}(\d{3,}))\s*\)/);
				if (em) {
					cachedToken = em[1].toUpperCase();
					cachedDigits = em[2];
					return true;
				}
			}
		} catch {}
		return false;
	}
	var ladderFns = new Map();
	var ladderArmed = new Set();
	function ladder(fn, times) {
		for (const ms of times) {
			let arr = ladderFns.get(ms);
			if (!arr) {
				arr = [];
				ladderFns.set(ms, arr);
			}
			arr.push(fn);
			if (!ladderArmed.has(ms)) {
				ladderArmed.add(ms);
				setTimeout(() => {
					for (const f of ladderFns.get(ms) || []) try {
						f(ms);
					} catch {}
				}, ms);
			}
		}
	}
	var snapshot = null;
	var settledFlag = false;
	var WarnRecord = object({
		age: boolean(),
		allergies: boolean(),
		meds: boolean(),
		rel: boolean(),
		key: string().nullable().optional(),
		ts: number()
	}).passthrough();
	var NoteOpenRecord = object({ ts: number() }).passthrough();
	function readLS(name) {
		try {
			const raw = localStorage.getItem(name);
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}
	window.__tmCore = {
		_identity() {
			return cachedToken ? {
				token: cachedToken,
				digits: cachedDigits
			} : null;
		},
		key() {
			if (cachedToken) adoptFromTop();
			else if (!adoptFromTop() && !scanHeader()) return null;
			return "chart:" + cachedToken;
		},
		chartDigits() {
			if (cachedDigits) adoptFromTop();
			else if (!adoptFromTop() && !scanHeader()) return "";
			return cachedDigits;
		},
		ladder,
		settle() {
			settledFlag = true;
		},
		settled() {
			return settledFlag;
		},
		setSnapshot(v) {
			const r = ChartSnapshot.safeParse(v);
			if (!r.success) return false;
			snapshot = r.data;
			return true;
		},
		getSnapshot() {
			return snapshot;
		},
		warn() {
			const r = WarnRecord.safeParse(readLS("tmTileWarn"));
			return r.success ? r.data : null;
		},
		noteOpen() {
			const r = NoteOpenRecord.safeParse(readLS("tmNoteOpen"));
			return r.success ? r.data : null;
		}
	};
	var t$1 = globalThis;
	var e$2 = t$1.ShadowRoot && (void 0 === t$1.ShadyCSS || t$1.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
	var s$2 = Symbol();
	var o$3 = new WeakMap();
	var n$2 = class {
		constructor(t, e, o) {
			if (this._$cssResult$ = !0, o !== s$2) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
			this.cssText = t, this.t = e;
		}
		get styleSheet() {
			let t = this.o;
			const s = this.t;
			if (e$2 && void 0 === t) {
				const e = void 0 !== s && 1 === s.length;
				e && (t = o$3.get(s)), void 0 === t && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), e && o$3.set(s, t));
			}
			return t;
		}
		toString() {
			return this.cssText;
		}
	};
	var r$2 = (t) => new n$2("string" == typeof t ? t : t + "", void 0, s$2);
	var S$1 = (s, o) => {
		if (e$2) s.adoptedStyleSheets = o.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
		else for (const e of o) {
			const o = document.createElement("style"), n = t$1.litNonce;
			void 0 !== n && o.setAttribute("nonce", n), o.textContent = e.cssText, s.appendChild(o);
		}
	};
	var c$2 = e$2 ? (t) => t : (t) => t instanceof CSSStyleSheet ? ((t) => {
		let e = "";
		for (const s of t.cssRules) e += s.cssText;
		return r$2(e);
	})(t) : t;
	var { is: i$2, defineProperty: e$1, getOwnPropertyDescriptor: h$1, getOwnPropertyNames: r$1, getOwnPropertySymbols: o$2, getPrototypeOf: n$1 } = Object, a$1 = globalThis, c$1 = a$1.trustedTypes, l$1 = c$1 ? c$1.emptyScript : "", p$1 = a$1.reactiveElementPolyfillSupport, d$1 = (t, s) => t, u$1 = {
		toAttribute(t, s) {
			switch (s) {
				case Boolean:
					t = t ? l$1 : null;
					break;
				case Object:
				case Array: t = null == t ? t : JSON.stringify(t);
			}
			return t;
		},
		fromAttribute(t, s) {
			let i = t;
			switch (s) {
				case Boolean:
					i = null !== t;
					break;
				case Number:
					i = null === t ? null : Number(t);
					break;
				case Object:
				case Array: try {
					i = JSON.parse(t);
				} catch (t) {
					i = null;
				}
			}
			return i;
		}
	}, f$1 = (t, s) => !i$2(t, s), b$1 = {
		attribute: !0,
		type: String,
		converter: u$1,
		reflect: !1,
		useDefault: !1,
		hasChanged: f$1
	};
	Symbol.metadata ??= Symbol("metadata"), a$1.litPropertyMetadata ??= new WeakMap();
	var y$1 = class extends HTMLElement {
		static addInitializer(t) {
			this._$Ei(), (this.l ??= []).push(t);
		}
		static get observedAttributes() {
			return this.finalize(), this._$Eh && [...this._$Eh.keys()];
		}
		static createProperty(t, s = b$1) {
			if (s.state && (s.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((s = Object.create(s)).wrapped = !0), this.elementProperties.set(t, s), !s.noAccessor) {
				const i = Symbol(), h = this.getPropertyDescriptor(t, i, s);
				void 0 !== h && e$1(this.prototype, t, h);
			}
		}
		static getPropertyDescriptor(t, s, i) {
			const { get: e, set: r } = h$1(this.prototype, t) ?? {
				get() {
					return this[s];
				},
				set(t) {
					this[s] = t;
				}
			};
			return {
				get: e,
				set(s) {
					const h = e?.call(this);
					r?.call(this, s), this.requestUpdate(t, h, i);
				},
				configurable: !0,
				enumerable: !0
			};
		}
		static getPropertyOptions(t) {
			return this.elementProperties.get(t) ?? b$1;
		}
		static _$Ei() {
			if (this.hasOwnProperty(d$1("elementProperties"))) return;
			const t = n$1(this);
			t.finalize(), void 0 !== t.l && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
		}
		static finalize() {
			if (this.hasOwnProperty(d$1("finalized"))) return;
			if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(d$1("properties"))) {
				const t = this.properties, s = [...r$1(t), ...o$2(t)];
				for (const i of s) this.createProperty(i, t[i]);
			}
			const t = this[Symbol.metadata];
			if (null !== t) {
				const s = litPropertyMetadata.get(t);
				if (void 0 !== s) for (const [t, i] of s) this.elementProperties.set(t, i);
			}
			this._$Eh = new Map();
			for (const [t, s] of this.elementProperties) {
				const i = this._$Eu(t, s);
				void 0 !== i && this._$Eh.set(i, t);
			}
			this.elementStyles = this.finalizeStyles(this.styles);
		}
		static finalizeStyles(s) {
			const i = [];
			if (Array.isArray(s)) {
				const e = new Set(s.flat(1 / 0).reverse());
				for (const s of e) i.unshift(c$2(s));
			} else void 0 !== s && i.push(c$2(s));
			return i;
		}
		static _$Eu(t, s) {
			const i = s.attribute;
			return !1 === i ? void 0 : "string" == typeof i ? i : "string" == typeof t ? t.toLowerCase() : void 0;
		}
		constructor() {
			super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
		}
		_$Ev() {
			this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t) => t(this));
		}
		addController(t) {
			(this._$EO ??= new Set()).add(t), void 0 !== this.renderRoot && this.isConnected && t.hostConnected?.();
		}
		removeController(t) {
			this._$EO?.delete(t);
		}
		_$E_() {
			const t = new Map(), s = this.constructor.elementProperties;
			for (const i of s.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
			t.size > 0 && (this._$Ep = t);
		}
		createRenderRoot() {
			const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
			return S$1(t, this.constructor.elementStyles), t;
		}
		connectedCallback() {
			this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
		}
		enableUpdating(t) {}
		disconnectedCallback() {
			this._$EO?.forEach((t) => t.hostDisconnected?.());
		}
		attributeChangedCallback(t, s, i) {
			this._$AK(t, i);
		}
		_$ET(t, s) {
			const i = this.constructor.elementProperties.get(t), e = this.constructor._$Eu(t, i);
			if (void 0 !== e && !0 === i.reflect) {
				const h = (void 0 !== i.converter?.toAttribute ? i.converter : u$1).toAttribute(s, i.type);
				this._$Em = t, null == h ? this.removeAttribute(e) : this.setAttribute(e, h), this._$Em = null;
			}
		}
		_$AK(t, s) {
			const i = this.constructor, e = i._$Eh.get(t);
			if (void 0 !== e && this._$Em !== e) {
				const t = i.getPropertyOptions(e), h = "function" == typeof t.converter ? { fromAttribute: t.converter } : void 0 !== t.converter?.fromAttribute ? t.converter : u$1;
				this._$Em = e;
				const r = h.fromAttribute(s, t.type);
				this[e] = r ?? this._$Ej?.get(e) ?? r, this._$Em = null;
			}
		}
		requestUpdate(t, s, i, e = !1, h) {
			if (void 0 !== t) {
				const r = this.constructor;
				if (!1 === e && (h = this[t]), i ??= r.getPropertyOptions(t), !((i.hasChanged ?? f$1)(h, s) || i.useDefault && i.reflect && h === this._$Ej?.get(t) && !this.hasAttribute(r._$Eu(t, i)))) return;
				this.C(t, s, i);
			}
			!1 === this.isUpdatePending && (this._$ES = this._$EP());
		}
		C(t, s, { useDefault: i, reflect: e, wrapped: h }, r) {
			i && !(this._$Ej ??= new Map()).has(t) && (this._$Ej.set(t, r ?? s ?? this[t]), !0 !== h || void 0 !== r) || (this._$AL.has(t) || (this.hasUpdated || i || (s = void 0), this._$AL.set(t, s)), !0 === e && this._$Em !== t && (this._$Eq ??= new Set()).add(t));
		}
		async _$EP() {
			this.isUpdatePending = !0;
			try {
				await this._$ES;
			} catch (t) {
				Promise.reject(t);
			}
			const t = this.scheduleUpdate();
			return null != t && await t, !this.isUpdatePending;
		}
		scheduleUpdate() {
			return this.performUpdate();
		}
		performUpdate() {
			if (!this.isUpdatePending) return;
			if (!this.hasUpdated) {
				if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
					for (const [t, s] of this._$Ep) this[t] = s;
					this._$Ep = void 0;
				}
				const t = this.constructor.elementProperties;
				if (t.size > 0) for (const [s, i] of t) {
					const { wrapped: t } = i, e = this[s];
					!0 !== t || this._$AL.has(s) || void 0 === e || this.C(s, void 0, i, e);
				}
			}
			let t = !1;
			const s = this._$AL;
			try {
				t = this.shouldUpdate(s), t ? (this.willUpdate(s), this._$EO?.forEach((t) => t.hostUpdate?.()), this.update(s)) : this._$EM();
			} catch (s) {
				throw t = !1, this._$EM(), s;
			}
			t && this._$AE(s);
		}
		willUpdate(t) {}
		_$AE(t) {
			this._$EO?.forEach((t) => t.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
		}
		_$EM() {
			this._$AL = new Map(), this.isUpdatePending = !1;
		}
		get updateComplete() {
			return this.getUpdateComplete();
		}
		getUpdateComplete() {
			return this._$ES;
		}
		shouldUpdate(t) {
			return !0;
		}
		update(t) {
			this._$Eq &&= this._$Eq.forEach((t) => this._$ET(t, this[t])), this._$EM();
		}
		updated(t) {}
		firstUpdated(t) {}
	};
	y$1.elementStyles = [], y$1.shadowRootOptions = { mode: "open" }, y$1[d$1("elementProperties")] = new Map(), y$1[d$1("finalized")] = new Map(), p$1?.({ ReactiveElement: y$1 }), (a$1.reactiveElementVersions ??= []).push("2.1.2");
	var t = globalThis;
	var i$1 = (t) => t;
	var s$1 = t.trustedTypes;
	var e = s$1 ? s$1.createPolicy("lit-html", { createHTML: (t) => t }) : void 0;
	var h = "$lit$";
	var o$1 = `lit$${Math.random().toFixed(9).slice(2)}$`;
	var n = "?" + o$1;
	var r = `<${n}>`;
	var l = document;
	var c = () => l.createComment("");
	var a = (t) => null === t || "object" != typeof t && "function" != typeof t;
	var u = Array.isArray;
	var d = (t) => u(t) || "function" == typeof t?.[Symbol.iterator];
	var f = "[ 	\n\f\r]";
	var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
	var _ = /-->/g;
	var m = />/g;
	var p = RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g");
	var g = /'/g;
	var $ = /"/g;
	var y = /^(?:script|style|textarea|title)$/i;
	var x = (t) => (i, ...s) => ({
		_$litType$: t,
		strings: i,
		values: s
	});
	var b = x(1);
	var E = Symbol.for("lit-noChange");
	var A = Symbol.for("lit-nothing");
	var C = new WeakMap();
	var P = l.createTreeWalker(l, 129);
	function V(t, i) {
		if (!u(t) || !t.hasOwnProperty("raw")) throw Error("invalid template strings array");
		return void 0 !== e ? e.createHTML(i) : i;
	}
	var N = (t, i) => {
		const s = t.length - 1, e = [];
		let n, l = 2 === i ? "<svg>" : 3 === i ? "<math>" : "", c = v;
		for (let i = 0; i < s; i++) {
			const s = t[i];
			let a, u, d = -1, f = 0;
			for (; f < s.length && (c.lastIndex = f, u = c.exec(s), null !== u);) f = c.lastIndex, c === v ? "!--" === u[1] ? c = _ : void 0 !== u[1] ? c = m : void 0 !== u[2] ? (y.test(u[2]) && (n = RegExp("</" + u[2], "g")), c = p) : void 0 !== u[3] && (c = p) : c === p ? ">" === u[0] ? (c = n ?? v, d = -1) : void 0 === u[1] ? d = -2 : (d = c.lastIndex - u[2].length, a = u[1], c = void 0 === u[3] ? p : "\"" === u[3] ? $ : g) : c === $ || c === g ? c = p : c === _ || c === m ? c = v : (c = p, n = void 0);
			const x = c === p && t[i + 1].startsWith("/>") ? " " : "";
			l += c === v ? s + r : d >= 0 ? (e.push(a), s.slice(0, d) + h + s.slice(d) + o$1 + x) : s + o$1 + (-2 === d ? i : x);
		}
		return [V(t, l + (t[s] || "<?>") + (2 === i ? "</svg>" : 3 === i ? "</math>" : "")), e];
	};
	var S = class S {
		constructor({ strings: t, _$litType$: i }, e) {
			let r;
			this.parts = [];
			let l = 0, a = 0;
			const u = t.length - 1, d = this.parts, [f, v] = N(t, i);
			if (this.el = S.createElement(f, e), P.currentNode = this.el.content, 2 === i || 3 === i) {
				const t = this.el.content.firstChild;
				t.replaceWith(...t.childNodes);
			}
			for (; null !== (r = P.nextNode()) && d.length < u;) {
				if (1 === r.nodeType) {
					if (r.hasAttributes()) for (const t of r.getAttributeNames()) if (t.endsWith(h)) {
						const i = v[a++], s = r.getAttribute(t).split(o$1), e = /([.?@])?(.*)/.exec(i);
						d.push({
							type: 1,
							index: l,
							name: e[2],
							strings: s,
							ctor: "." === e[1] ? I : "?" === e[1] ? L : "@" === e[1] ? z : H
						}), r.removeAttribute(t);
					} else t.startsWith(o$1) && (d.push({
						type: 6,
						index: l
					}), r.removeAttribute(t));
					if (y.test(r.tagName)) {
						const t = r.textContent.split(o$1), i = t.length - 1;
						if (i > 0) {
							r.textContent = s$1 ? s$1.emptyScript : "";
							for (let s = 0; s < i; s++) r.append(t[s], c()), P.nextNode(), d.push({
								type: 2,
								index: ++l
							});
							r.append(t[i], c());
						}
					}
				} else if (8 === r.nodeType) if (r.data === n) d.push({
					type: 2,
					index: l
				});
				else {
					let t = -1;
					for (; -1 !== (t = r.data.indexOf(o$1, t + 1));) d.push({
						type: 7,
						index: l
					}), t += o$1.length - 1;
				}
				l++;
			}
		}
		static createElement(t, i) {
			const s = l.createElement("template");
			return s.innerHTML = t, s;
		}
	};
	function M(t, i, s = t, e) {
		if (i === E) return i;
		let h = void 0 !== e ? s._$Co?.[e] : s._$Cl;
		const o = a(i) ? void 0 : i._$litDirective$;
		return h?.constructor !== o && (h?._$AO?.(!1), void 0 === o ? h = void 0 : (h = new o(t), h._$AT(t, s, e)), void 0 !== e ? (s._$Co ??= [])[e] = h : s._$Cl = h), void 0 !== h && (i = M(t, h._$AS(t, i.values), h, e)), i;
	}
	var R = class {
		constructor(t, i) {
			this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = i;
		}
		get parentNode() {
			return this._$AM.parentNode;
		}
		get _$AU() {
			return this._$AM._$AU;
		}
		u(t) {
			const { el: { content: i }, parts: s } = this._$AD, e = (t?.creationScope ?? l).importNode(i, !0);
			P.currentNode = e;
			let h = P.nextNode(), o = 0, n = 0, r = s[0];
			for (; void 0 !== r;) {
				if (o === r.index) {
					let i;
					2 === r.type ? i = new k(h, h.nextSibling, this, t) : 1 === r.type ? i = new r.ctor(h, r.name, r.strings, this, t) : 6 === r.type && (i = new Z(h, this, t)), this._$AV.push(i), r = s[++n];
				}
				o !== r?.index && (h = P.nextNode(), o++);
			}
			return P.currentNode = l, e;
		}
		p(t) {
			let i = 0;
			for (const s of this._$AV) void 0 !== s && (void 0 !== s.strings ? (s._$AI(t, s, i), i += s.strings.length - 2) : s._$AI(t[i])), i++;
		}
	};
	var k = class k {
		get _$AU() {
			return this._$AM?._$AU ?? this._$Cv;
		}
		constructor(t, i, s, e) {
			this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t, this._$AB = i, this._$AM = s, this.options = e, this._$Cv = e?.isConnected ?? !0;
		}
		get parentNode() {
			let t = this._$AA.parentNode;
			const i = this._$AM;
			return void 0 !== i && 11 === t?.nodeType && (t = i.parentNode), t;
		}
		get startNode() {
			return this._$AA;
		}
		get endNode() {
			return this._$AB;
		}
		_$AI(t, i = this) {
			t = M(this, t, i), a(t) ? t === A || null == t || "" === t ? (this._$AH !== A && this._$AR(), this._$AH = A) : t !== this._$AH && t !== E && this._(t) : void 0 !== t._$litType$ ? this.$(t) : void 0 !== t.nodeType ? this.T(t) : d(t) ? this.k(t) : this._(t);
		}
		O(t) {
			return this._$AA.parentNode.insertBefore(t, this._$AB);
		}
		T(t) {
			this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
		}
		_(t) {
			this._$AH !== A && a(this._$AH) ? this._$AA.nextSibling.data = t : this.T(l.createTextNode(t)), this._$AH = t;
		}
		$(t) {
			const { values: i, _$litType$: s } = t, e = "number" == typeof s ? this._$AC(t) : (void 0 === s.el && (s.el = S.createElement(V(s.h, s.h[0]), this.options)), s);
			if (this._$AH?._$AD === e) this._$AH.p(i);
			else {
				const t = new R(e, this), s = t.u(this.options);
				t.p(i), this.T(s), this._$AH = t;
			}
		}
		_$AC(t) {
			let i = C.get(t.strings);
			return void 0 === i && C.set(t.strings, i = new S(t)), i;
		}
		k(t) {
			u(this._$AH) || (this._$AH = [], this._$AR());
			const i = this._$AH;
			let s, e = 0;
			for (const h of t) e === i.length ? i.push(s = new k(this.O(c()), this.O(c()), this, this.options)) : s = i[e], s._$AI(h), e++;
			e < i.length && (this._$AR(s && s._$AB.nextSibling, e), i.length = e);
		}
		_$AR(t = this._$AA.nextSibling, s) {
			for (this._$AP?.(!1, !0, s); t !== this._$AB;) {
				const s = i$1(t).nextSibling;
				i$1(t).remove(), t = s;
			}
		}
		setConnected(t) {
			void 0 === this._$AM && (this._$Cv = t, this._$AP?.(t));
		}
	};
	var H = class {
		get tagName() {
			return this.element.tagName;
		}
		get _$AU() {
			return this._$AM._$AU;
		}
		constructor(t, i, s, e, h) {
			this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t, this.name = i, this._$AM = e, this.options = h, s.length > 2 || "" !== s[0] || "" !== s[1] ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = A;
		}
		_$AI(t, i = this, s, e) {
			const h = this.strings;
			let o = !1;
			if (void 0 === h) t = M(this, t, i, 0), o = !a(t) || t !== this._$AH && t !== E, o && (this._$AH = t);
			else {
				const e = t;
				let n, r;
				for (t = h[0], n = 0; n < h.length - 1; n++) r = M(this, e[s + n], i, n), r === E && (r = this._$AH[n]), o ||= !a(r) || r !== this._$AH[n], r === A ? t = A : t !== A && (t += (r ?? "") + h[n + 1]), this._$AH[n] = r;
			}
			o && !e && this.j(t);
		}
		j(t) {
			t === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
		}
	};
	var I = class extends H {
		constructor() {
			super(...arguments), this.type = 3;
		}
		j(t) {
			this.element[this.name] = t === A ? void 0 : t;
		}
	};
	var L = class extends H {
		constructor() {
			super(...arguments), this.type = 4;
		}
		j(t) {
			this.element.toggleAttribute(this.name, !!t && t !== A);
		}
	};
	var z = class extends H {
		constructor(t, i, s, e, h) {
			super(t, i, s, e, h), this.type = 5;
		}
		_$AI(t, i = this) {
			if ((t = M(this, t, i, 0) ?? A) === E) return;
			const s = this._$AH, e = t === A && s !== A || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, h = t !== A && (s === A || e);
			e && this.element.removeEventListener(this.name, this, s), h && this.element.addEventListener(this.name, this, t), this._$AH = t;
		}
		handleEvent(t) {
			"function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
		}
	};
	var Z = class {
		constructor(t, i, s) {
			this.element = t, this.type = 6, this._$AN = void 0, this._$AM = i, this.options = s;
		}
		get _$AU() {
			return this._$AM._$AU;
		}
		_$AI(t) {
			M(this, t);
		}
	};
	var B = t.litHtmlPolyfillSupport;
	B?.(S, k), (t.litHtmlVersions ??= []).push("3.3.3");
	var D = (t, i, s) => {
		const e = s?.renderBefore ?? i;
		let h = e._$litPart$;
		if (void 0 === h) {
			const t = s?.renderBefore ?? null;
			e._$litPart$ = h = new k(i.insertBefore(c(), t), t, void 0, s ?? {});
		}
		return h._$AI(t), h;
	};
	var s = globalThis;
	var i = class extends y$1 {
		constructor() {
			super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
		}
		createRenderRoot() {
			const t = super.createRenderRoot();
			return this.renderOptions.renderBefore ??= t.firstChild, t;
		}
		update(t) {
			const r = this.render();
			this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = D(r, this.renderRoot, this.renderOptions);
		}
		connectedCallback() {
			super.connectedCallback(), this._$Do?.setConnected(!0);
		}
		disconnectedCallback() {
			super.disconnectedCallback(), this._$Do?.setConnected(!1);
		}
		render() {
			return E;
		}
	};
	i._$litElement$ = !0, i["finalized"] = !0, s.litElementHydrateSupport?.({ LitElement: i });
	var o = s.litElementPolyfillSupport;
	o?.({ LitElement: i });
	(s.litElementVersions ??= []).push("4.2.2");
	var TmTile = class extends i {
		static properties = {
			label: { type: String },
			value: { type: String },
			opts: { type: Object },
			chip: { type: String }
		};
		constructor() {
			super();
			this.label = "";
			this.value = "";
			this.opts = {};
			this.chip = "";
			this.stamp = "";
		}
		createRenderRoot() {
			return this;
		}
		hooks() {
			return window.__tmCore?.hooks || {};
		}
		card() {
			return this.querySelector("[data-tm-card]");
		}
		labelSpan() {
			return this.querySelector("[data-tm-label]");
		}
		onAnchorClick(e) {
			e.stopPropagation();
			e.preventDefault();
			this.hooks().cycleSummaryAnchor?.(this);
		}
		onMouseDown() {
			const o = this.opts || {};
			if (o.click || o.delegate || o.nav || o.action) this.hooks().hlTile?.(this.card(), false);
		}
		onClick() {
			const o = this.opts || {};
			const h = this.hooks();
			if (o.nav) {
				if (!h.goWtsVitals?.()) {
					const ls = this.labelSpan();
					if (ls) {
						if (!ls.getAttribute("data-tm-orig")) ls.setAttribute("data-tm-orig", ls.textContent || "");
						ls.textContent = "Not found";
						setTimeout(() => {
							const orig = ls.getAttribute("data-tm-orig");
							if (orig) {
								ls.textContent = orig;
								ls.removeAttribute("data-tm-orig");
							}
						}, 1400);
					}
				}
				return;
			}
			if (o.delegate === "meds") {
				const p = h.medsPanel?.();
				if (p && p.btn) {
					h.fireClick?.(p.btn);
					h.flashLabel?.(this.labelSpan(), this.card());
				}
				return;
			}
			if (o.action) {
				h.action?.(o.action);
				return;
			}
			if (o.click) {
				h.queueCopy?.(o.click.label, o.click.value);
				h.flashLabel?.(this.labelSpan(), this.card());
			}
		}
		render() {
			const o = this.opts || {};
			const clickable = !!(o.click || o.delegate || o.nav || o.action);
			const cardCss = "background:" + (o.warn ? "#ff1a1a" : o.rose ? "#fdf3f2" : "#fff") + ";border:1px solid " + (o.warn ? "#ff8080" : o.rose ? "#f0c8c2" : "#e2e8f0") + ";border-radius:12px;box-shadow:" + (o.warn ? "0 0 10px rgba(255,26,26,.55),0 1px 3px rgba(15,23,42,.05)" : "0 1px 3px rgba(15,23,42,.05)") + ";padding:" + (o.pad || "12px 16px 14px") + ";min-width:" + (o.minW || 0) + "px;" + (o.frozenW && o.frozenH ? "flex:none;width:" + o.frozenW + "px;height:" + o.frozenH + "px;overflow:hidden;" : o.full ? "flex:1 1 auto;min-width:0;" : o.wide ? "flex:1 1 180px;min-width:0;" : o.grow ? "flex:1 1 400px;min-width:0;" : o.natW ? "flex:none;width:auto;" + (o.maxW ? "max-width:" + o.maxW + "px;" : "") : o.fixedW ? "flex:0 1 " + o.fixedW + "px;width:" + o.fixedW + "px;" : "flex:none;") + (o.maxw ? "max-width:" + o.maxw + ";" : "") + (clickable ? "cursor:pointer;" : "");
			const labelCss = "white-space:nowrap;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:" + (o.warn ? "#ffe1e1" : o.rose ? "#a05a52" : "#8494a7") + ";";
			const fontCss = "font-size:" + (o.size || 21) + "px;font-weight:" + (o.weight || 700) + ";line-height:" + (o.multi ? "1.45" : "1.3") + ";color:" + (o.warn ? "#ffffff" : o.color || "#131c2b") + ";";
			const chipCss = "font-size:16px;font-weight:800;color:" + (o.warn ? "#ffffff" : "#2563eb") + ";";
			if (o.rows) {
				const rowLines = String(this.value || "").split("\n").filter((ln) => ln.length);
				return b`<div data-tm-card style=${cardCss} title=${clickable ? "Click to copy" : ""} @mousedown=${this.onMouseDown} @click=${this.onClick}>
      <div style="margin-top:2px;">${rowLines.map((ln, i) => {
					const cut = ln.indexOf("|");
					const lab = cut >= 0 ? ln.slice(0, cut) : ln;
					const val = cut >= 0 ? ln.slice(cut + 1) : "";
					return b`<div class="tmAdmRow" style="display:flex;align-items:baseline;gap:8px;line-height:1.5;">
          <span class="tmAdmLab" ?data-tm-label=${i === 0} style="flex:none;width:66px;font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8494a7;">${lab}</span>
          <span class="tmAdmVal" style="font-size:12.5px;font-weight:700;color:${val === "—" ? "#b6c2d2" : "#131c2b"};">${val}</span>
        </div>`;
				})}</div>
    </div>`;
			}
			let valuePart;
			if (!this.value) valuePart = b`<div style=${"margin-top:9px;" + fontCss + "color:#b6c2d2;"}>—</div>`;
			else if (o.cols) {
				const lines = String(this.value).split("\n");
				const ncols = Math.max(1, Math.ceil(lines.length / 4));
				const per = Math.ceil(lines.length / ncols);
				const cols = [];
				for (let ci = 0; ci < ncols; ci++) cols.push(lines.slice(ci * per, (ci + 1) * per));
				valuePart = b`<div data-medsfit="1" style="margin-top:9px;display:flex;gap:26px;min-width:0;">${cols.map((slice) => b`<div style="max-width:300px;flex:1 1 0;min-width:0;">${slice.map((ln) => b`<div class="tmMedLine" style=${fontCss + "white-space:nowrap;"}>${ln}</div>`)}</div>`)}</div>`;
			} else valuePart = b`<div ?data-fit=${!!o.fit} style=${"margin-top:9px;" + fontCss + (o.multi ? "white-space:pre-line;" : "") + (o.nowrap ? "white-space:nowrap;" : "")}>${this.value}</div>`;
			return b`<div data-tm-card style=${cardCss} title=${clickable ? "Click to copy" : ""} @mousedown=${this.onMouseDown} @click=${this.onClick}>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">
        <span data-tm-label style=${labelCss}>${this.label}</span>
        ${this.chip ? o.anchorCycle ? b`<span style=${chipCss} title="Switch summary window" @click=${this.onAnchorClick}>${this.chip}</span>` : b`<span style=${chipCss}>${this.chip}</span>` : ""}
      </div>
      ${valuePart}
      ${this.stamp ? b`<div style="font-size:10px;font-weight:500;color:#9aa1ab;margin-top:4px;">${this.stamp}</div>` : ""}
    </div>`;
		}
	};
	customElements.define("tm-tile", TmTile);
	(function() {
		var PSYCH = /\b(benztropine|cogentin|trihexyphenidyl|artane|procyclidine|biperiden|amantadine|valbenazine|ingrezza|deutetrabenazine|austedo|tetrabenazine|xenazine|donepezil|aricept|memantine|namenda|namzaric|galantamine|razadyne|rivastigmine|exelon|olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|aripiprazole|abilify|ziprasidone|geodon|haloperidol|haldol|clozapine|clozaril|lurasidone|latuda|paliperidone|invega|asenapine|saphris|brexpiprazole|rexulti|cariprazine|vraylar|lumateperone|caplyta|iloperidone|chlorpromazine|fluphenazine|perphenazine|thioridazine|thiothixene|loxapine|trifluoperazine|pimavanserin|nuplazid|sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|bupropion|wellbutrin|mirtazapine|remeron|trazodone|nefazodone|vilazodone|viibryd|vortioxetine|trintellix|amitriptyline|nortriptyline|pamelor|imipramine|desipramine|doxepin|clomipramine|protriptyline|trimipramine|amoxapine|maprotiline|phenelzine|tranylcypromine|isocarboxazid|selegiline|emsam|lithium|lamotrigine|lamictal|valpro|divalproex|depakote|carbamazepine|tegretol|oxcarbazepine|trileptal|buspirone|buspar|hydroxyzine|lorazepam|ativan|alprazolam|xanax|clonazepam|klonopin|diazepam|valium|temazepam|oxazepam|chlordiazepoxide|clorazepate|zolpidem|ambien|eszopiclone|lunesta|zaleplon|ramelteon|suvorexant|lemborexant|nuedexta)/i;
		var TIER2_COUNTED = /\b(melatonin|methylphenidate|ritalin|concerta|metadate|methylin|daytrana|quillivant|quillichew|jornay|dexmethylphenidate|focalin|dextroamphetamine|dexedrine|procentra|zenzedi|amphetamine|adderall|lisdexamfetamine|vyvanse|methamphetamine|desoxyn)/i;
		var TIER2_UNCOUNTED = /\b(naltrexone|vivitrol|revia|buprenorphine|subutex|sublocade|brixadi|suboxone|zubsolv|bunavail|methadone|acamprosate|campral|disulfiram|antabuse|varenicline|chantix|lofexidine|lucemyra)/i;
		var PAIN = /\b(oxycodone|oxycontin|percocet|hydrocodone|vicodin|norco|morphine|ms contin|hydromorphone|dilaudid|fentanyl|codeine|tramadol|ultram|meperidine|demerol|tapentadol|nucynta|ibuprofen|advil|motrin|naproxen|aleve|meloxicam|celecoxib|celebrex|diclofenac|indomethacin|ketorolac|toradol|cyclobenzaprine|flexeril|methocarbamol|robaxin|baclofen|tizanidine|zanaflex|carisoprodol|soma|gabapentin|neurontin|pregabalin|lyrica)/i;
		var UTI_TREATMENT = /\b(nitrofurantoin|macrobid|macrodantin|fosfomycin|monurol)\b/i;
		var UTI_SYMPTOM = /\b(phenazopyridine|pyridium)\b/i;
		var UTI_POSSIBLE = /\b(trimethoprim|sulfamethoxazole|bactrim|septra|ciprofloxacin|cipro|levofloxacin|levaquin|cephalexin|keflex|amoxicillin[\s-]*clavulanate|augmentin)\b/i;
		var UTI_PREVENTION = /\b(methenamine|hiprex|urex)\b/i;
		var SSRI_SNRI = /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|vilazodone|viibryd|vortioxetine|trintellix)/i;
		var SSRI_ONLY = /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine)/i;
		var ANTIDEPRESSANT = /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|bupropion|wellbutrin|mirtazapine|remeron|trazodone|nefazodone|vilazodone|viibryd|vortioxetine|trintellix|amitriptyline|nortriptyline|pamelor|imipramine|desipramine|doxepin|clomipramine|protriptyline|trimipramine|amoxapine|maprotiline)/i;
		var MAOI = /\b(phenelzine|nardil|tranylcypromine|parnate|isocarboxazid|marplan|selegiline|emsam|rasagiline|azilect)/i;
		var SEROTONERGIC = /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|vilazodone|viibryd|vortioxetine|trintellix|trazodone|clomipramine|tramadol|ultram|sumatriptan|rizatriptan|zolmitriptan|naratriptan|almotriptan|frovatriptan|eletriptan|linezolid|lithium|buspirone|buspar|dextromethorphan|nuedexta)/i;
		var ANTICOAG_NSAID = /\b(warfarin|coumadin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|edoxaban|savaysa|heparin|enoxaparin|lovenox|aspirin|clopidogrel|plavix|ibuprofen|advil|motrin|naproxen|aleve|meloxicam|celecoxib|celebrex|diclofenac|indomethacin|ketorolac|toradol)/i;
		var QTC = /\b(citalopram|celexa|ziprasidone|geodon|haloperidol|haldol|quetiapine|seroquel|methadone|ondansetron|zofran|azithromycin|erythromycin|levofloxacin|ciprofloxacin|moxifloxacin|amiodarone|sotalol)/i;
		var BENZO = /\b(lorazepam|ativan|alprazolam|xanax|clonazepam|klonopin|diazepam|valium|temazepam|oxazepam|chlordiazepoxide|clorazepate)/i;
		var OPIOID = /\b(oxycodone|oxycontin|percocet|hydrocodone|vicodin|norco|morphine|ms contin|hydromorphone|dilaudid|fentanyl|codeine|tramadol|ultram|methadone|buprenorphine|meperidine|demerol|tapentadol|nucynta)/i;
		var ZDRUG = /\b(zolpidem|ambien|eszopiclone|lunesta|zaleplon)/i;
		var ANTIPSYCHOTIC = /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|aripiprazole|abilify|ziprasidone|geodon|haloperidol|haldol|clozapine|clozaril|lurasidone|latuda|paliperidone|invega|asenapine|saphris|brexpiprazole|rexulti|cariprazine|vraylar|lumateperone|caplyta|iloperidone|chlorpromazine|fluphenazine|perphenazine|thioridazine|thiothixene|loxapine|trifluoperazine|pimavanserin|nuplazid)/i;
		var ANTICHOLINERGIC = /\b(benztropine|cogentin|trihexyphenidyl|artane|diphenhydramine|benadryl)/i;
		var ORTHOSTATIC = /\b(trazodone|amitriptyline|nortriptyline|pamelor|imipramine|desipramine|doxepin|clomipramine|protriptyline|trimipramine|amoxapine|maprotiline)/i;
		var FALL_RISK = new RegExp(BENZO.source + "|" + ZDRUG.source + "|" + ANTIPSYCHOTIC.source + "|" + ANTICHOLINERGIC.source + "|" + ORTHOSTATIC.source + "|" + OPIOID.source, "i");
		function getPatientAge() {
			try {
				var docs = [];
				try {
					if (window.top && window.top.document) docs.push(window.top.document);
				} catch (e) {}
				if (docs.indexOf(document) === -1) docs.push(document);
				for (var d = 0; d < docs.length; d++) {
					var text = docs[d].body && docs[d].body.textContent || "";
					var m = text.match(/\((\d{1,3})\s*\/\s*(Female|Male|F|M)\)/i);
					if (m) return parseInt(m[1], 10);
					m = text.match(/\bAge\s*:\s*(\d{1,3})\b/i);
					if (m) return parseInt(m[1], 10);
				}
			} catch (e2) {}
			return null;
		}
		var BEERS_ANTICHOLINERGIC = /\b(diphenhydramine|benadryl|oxybutynin|ditropan|tolterodine|detrol|solifenacin|vesicare|darifenacin|fesoterodine|trospium|scopolamine|atropine|dicyclomine|bentyl|hyoscyamine|levsin|meclizine|antivert|promethazine|phenergan|hydroxyzine|vistaril|atarax|doxepin|sinequan|amitriptyline|elavil|imipramine|tofranil|clomipramine|anafranil|paroxetine|paxil|olanzapine|zyprexa|quetiapine|seroquel|benztropine|cogentin|trihexyphenidyl|artane)\b/i;
		var BEERS_BENZO = BENZO;
		var BEERS_ZDRUG = ZDRUG;
		var BEERS_NSAID = /\b(ibuprofen|advil|motrin|naproxen|aleve|meloxicam|mobic|celecoxib|celebrex|diclofenac|voltaren|indomethacin|indocin|ketorolac|toradol|piroxicam|nabumetone)\b/i;
		var LAB_MONITORING = [
			{
				rx: /\blithium\b/i,
				labs: "Lithium level q3-6mo (5-7 days after start/dose change, then q2-3mo x2), BMP/creatinine q3-6mo with level, TSH q6-12mo, calcium annually"
			},
			{
				rx: /\b(valproate|divalproex|depakote|depakene)\b/i,
				labs: "Valproate level 3-5 days after steady state then q6-12mo, LFTs baseline then q6-12mo, CBC with platelets baseline then q6-12mo"
			},
			{
				rx: /\bcarbamazepine|tegretol\b/i,
				labs: "Carbamazepine level after steady state then q6-12mo, CBC baseline + 2 weeks then q3mo, LFTs baseline then q6-12mo, sodium baseline then periodically"
			},
			{
				rx: /\boxcarbazepine|trileptal\b/i,
				labs: "Sodium baseline + 2 weeks then periodically (SIADH risk)"
			},
			{
				rx: /\bclozapine|clozaril\b/i,
				labs: "ANC weekly x6mo, then q2weeks x6mo, then monthly (REMS protocol)"
			},
			{
				rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|haloperidol|haldol|lurasidone|latuda|asenapine|saphris|brexpiprazole|rexulti|cariprazine|vraylar|lumateperone|caplyta|iloperidone|fanapt|chlorpromazine|thorazine|fluphenazine|prolixin|perphenazine|trilafon)\b/i,
				labs: "Weight/BMI baseline + monthly x3 then quarterly, fasting glucose/HbA1c baseline + 12 weeks then annually, lipid panel baseline + 12 weeks then annually"
			},
			{
				rx: /\b(risperidone|risperdal|paliperidone|invega|haloperidol|haldol|fluphenazine|prolixin)\b/i,
				labs: "Prolactin only if galactorrhea/amenorrhea"
			},
			{
				rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|levomilnacipran|fetzima|vortioxetine|trintellix|vilazodone|viibryd)\b/i,
				labs: "Sodium baseline in elderly/high-risk then if symptoms (SIADH/hyponatremia)"
			},
			{
				rx: /\bmirtazapine|remeron\b/i,
				labs: "Weight baseline then periodically, lipid panel + fasting glucose baseline then annually if weight gain"
			},
			{
				rx: /\b(amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|desipramine|norpramin|doxepin|sinequan|clomipramine|anafranil|protriptyline|vivactil|trimipramine|surmontil)\b/i,
				labs: "EKG baseline + after dose changes, sodium baseline in elderly then if symptoms"
			},
			{
				rx: /\bbupropion|wellbutrin\b/i,
				labs: "Blood pressure baseline then periodically"
			},
			{
				rx: /\btrazodone|desyrel\b/i,
				labs: "Orthostatic vitals (orthostasis risk, especially elderly); no routine labs"
			},
			{
				rx: /\b(memantine|namenda)\b/i,
				labs: "No routine labs; renal dose adjustment in CKD; monitor cognition"
			},
			{
				rx: /\b(melatonin)\b/i,
				labs: "No labs required"
			},
			{
				rx: /\blamotrigine|lamictal\b/i,
				labs: "No routine labs; monitor skin for rash"
			},
			{
				rx: /\b(metformin|glucophage)\b/i,
				labs: "B12 annually, BMP q6-12mo (lactic acidosis risk in CKD), HbA1c q3-6mo"
			},
			{
				rx: /\b(insulin)\b/i,
				labs: "Glucose, HbA1c q3-6mo; monitor hypoglycemia (sweating, confusion, tremor)"
			},
			{
				rx: /\b(linagliptin|tradjenta|sitagliptin|januvia)\b/i,
				labs: "HbA1c q3-6mo; monitor pancreatitis symptoms (abdominal pain)"
			},
			{
				rx: /\b(glipizide|glucotrol|glyburide|diabeta|glimepiride|amaryl)\b/i,
				labs: "Glucose, HbA1c q3-6mo; monitor hypoglycemia"
			},
			{
				rx: /\b(lisinopril|zestril|enalapril|vasotec|ramipril|altace)\b/i,
				labs: "BMP (creatinine/K) 1-2 weeks after start then q6-12mo, BP; monitor cough, angioedema"
			},
			{
				rx: /\b(losartan|cozaar|valsartan|diovan|olmesartan|benicar)\b/i,
				labs: "BMP (creatinine/K) 1-2 weeks after start then q6-12mo, BP"
			},
			{
				rx: /\b(metoprolol|lopressor|toprol|atenolol|tenormin|carvedilol|coreg)\b/i,
				labs: "HR + BP; monitor bradycardia, fatigue, dizziness"
			},
			{
				rx: /\b(amlodipine|norvasc|diltiazem|cardizem|verapamil|calan)\b/i,
				labs: "BP; monitor edema, headache, flushing"
			},
			{
				rx: /\b(furosemide|lasix|hydrochlorothiazide|hctz|bumetanide|bumex|torsemide|demadex)\b/i,
				labs: "BMP (K, Mg, creatinine) 1-2 weeks after start then q3-6mo, weight, orthostatics; monitor dehydration, cramps"
			},
			{
				rx: /\b(digoxin|lanoxin)\b/i,
				labs: "Digoxin level 7-14 days after start then q6-12mo, BMP (K), EKG; monitor nausea, vision changes, arrhythmia (toxicity)"
			},
			{
				rx: /\b(warfarin|coumadin)\b/i,
				labs: "INR q4 weeks (stable) or per protocol; monitor bleeding, bruising"
			},
			{
				rx: /\b(apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa)\b/i,
				labs: "CBC + BMP annually; monitor bleeding"
			},
			{
				rx: /\b(omeprazole|prilosec|pantoprazole|protonix|esomeprazole|nexium|lansoprazole|prevacid)\b/i,
				labs: "B12 + magnesium annually if long-term; monitor bone fracture risk"
			},
			{
				rx: /\b(levothyroxine|synthroid)\b/i,
				labs: "TSH q6-12mo (6-8 weeks after dose change)"
			},
			{
				rx: /\b(ferrous sulfate|iron)\b/i,
				labs: "CBC, ferritin q3-6mo until repleted; monitor constipation, dark stools"
			},
			{
				rx: /\b(tamsulosin|flomax)\b/i,
				labs: "Orthostatic vitals, BP; monitor dizziness, especially first dose"
			},
			{
				rx: /\b(alendronate|fosamax|ibandronate|boniva)\b/i,
				labs: "Dental exam baseline; monitor jaw pain, dysphagia, atypical fractures"
			},
			{
				rx: /\b(sennosides|senna|docusate|colace|polyethylene glycol|miralax|lactulose)\b/i,
				labs: "Bowel movements; BMP if chronic use (electrolytes)"
			}
		];
		var BLACK_BOX = [
			{
				rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|levomilnacipran|fetzima|vortioxetine|trintellix|vilazodone|viibryd|mirtazapine|remeron|bupropion|wellbutrin|amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|desipramine|norpramin|doxepin|sinequan|clomipramine|anafranil)\b/i,
				text: "Suicidality: increased risk of suicidal thoughts/behaviors in children, adolescents, and young adults"
			},
			{
				rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|haloperidol|haldol|lurasidone|latuda|asenapine|saphris|brexpiprazole|rexulti|cariprazine|vraylar|lumateperone|caplyta|iloperidone|fanapt|chlorpromazine|thorazine|fluphenazine|prolixin|perphenazine|trilafon|clozapine|clozaril)\b/i,
				text: "Increased mortality in elderly patients with dementia-related psychosis"
			},
			{
				rx: /\b(clozapine|clozaril)\b/i,
				text: "Agranulocytosis, myocarditis/cardiomyopathy, severe constipation leading to ileus"
			},
			{
				rx: /\b(valproate|divalproex|depakote|depakene)\b/i,
				text: "Hepatotoxicity (fatal, esp. children <2), pancreatitis, teratogenicity (neural tube defects)"
			},
			{
				rx: /\b(carbamazepine|tegretol)\b/i,
				text: "Aplastic anemia/agranulocytosis, serious skin reactions (SJS/TEN)"
			},
			{
				rx: /\blithium\b/i,
				text: "Lithium toxicity (narrow therapeutic index); monitor levels closely"
			}
		];
		var CONDITION_WARNINGS = [
			{
				dx: /^H40/,
				dxName: "Glaucoma",
				rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox)\b/i,
				text: "SSRIs: mild mydriasis risk — monitor eye pain, blurred vision, halos, headache, nausea (angle closure symptoms)"
			},
			{
				dx: /^H40/,
				dxName: "Glaucoma",
				rx: /\b(venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|levomilnacipran|fetzima)\b/i,
				text: "SNRIs: mydriasis risk — monitor eye pain, blurred vision, halos"
			},
			{
				dx: /^H40/,
				dxName: "Glaucoma",
				rx: /\b(amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|desipramine|norpramin|doxepin|sinequan|clomipramine|anafranil|protriptyline|vivactil|trimipramine|surmontil)\b/i,
				text: "TCAs: strong anticholinergic — high angle-closure risk; monitor eye pain, redness, blurred vision, halos, headache, nausea/vomiting"
			},
			{
				dx: /^H40/,
				dxName: "Glaucoma",
				rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|chlorpromazine|thorazine|thioridazine|mellaril)\b/i,
				text: "Anticholinergic antipsychotics: angle-closure risk; monitor eye pain, blurred vision, halos"
			},
			{
				dx: /^H40/,
				dxName: "Glaucoma",
				rx: /\b(topiramate|topamax)\b/i,
				text: "Topiramate: acute angle-closure risk — monitor sudden eye pain, blurred vision, halos; urgent ophthalmology if symptoms"
			},
			{
				dx: /^H40/,
				dxName: "Glaucoma",
				rx: /\b(lithium|valproate|divalproex|depakote|carbamazepine|tegretol|lamotrigine|lamictal)\b/i,
				text: "Mood stabilizers: monitor intraocular pressure; report eye pain, blurred vision"
			},
			{
				dx: /^I50/,
				dxName: "Heart failure",
				rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|clozapine|clozaril|haloperidol|haldol)\b/i,
				text: "Antipsychotics: fluid retention, orthostasis — monitor daily weight, edema, SOB, crackles, orthostatic vitals"
			},
			{
				dx: /^I50/,
				dxName: "Heart failure",
				rx: /\b(amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|doxepin|sinequan|clomipramine|anafranil)\b/i,
				text: "TCAs: arrhythmia, orthostasis, worsened HF — monitor EKG, orthostatics, edema, SOB; consider alternative"
			},
			{
				dx: /^I50/,
				dxName: "Heart failure",
				rx: /\b(citalopram|celexa|escitalopram|lexapro)\b/i,
				text: "QT prolongation risk in HF — monitor EKG, palpitations, syncope"
			},
			{
				dx: /^N18|^N19/,
				dxName: "Kidney disease (CKD)",
				rx: /\blithium\b/i,
				text: "Lithium cleared renally — reduce dose for eGFR; monitor lithium level, creatinine/eGFR, polyuria, thirst, tremor, confusion (toxicity)"
			},
			{
				dx: /^N18|^N19/,
				dxName: "Kidney disease (CKD)",
				rx: /\b(gabapentin|neurontin|pregabalin|lyrica)\b/i,
				text: "Renally cleared — reduce dose for eGFR; monitor sedation, dizziness, edema"
			},
			{
				dx: /^N18|^N19/,
				dxName: "Kidney disease (CKD)",
				rx: /\b(topiramate|topamax)\b/i,
				text: "Renally cleared — reduce dose; monitor kidney stones, metabolic acidosis"
			},
			{
				dx: /^N18|^N19/,
				dxName: "Kidney disease (CKD)",
				rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox|venlafaxine|effexor|duloxetine|cymbalta)\b/i,
				text: "SSRIs/SNRIs: hyponatremia risk higher in CKD/elderly — monitor sodium, confusion, falls"
			},
			{
				dx: /^K7/,
				dxName: "Liver disease",
				rx: /\b(valproate|divalproex|depakote|depakene)\b/i,
				text: "Valproate hepatotoxic — avoid in liver disease; monitor LFTs, ammonia, lethargy, confusion, jaundice, abdominal pain"
			},
			{
				dx: /^K7/,
				dxName: "Liver disease",
				rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|aripiprazole|abilify|duloxetine|cymbalta|venlafaxine|effexor|mirtazapine|remeron)\b/i,
				text: "Hepatically metabolized — consider dose reduction; monitor LFTs, fatigue, jaundice, confusion"
			},
			{
				dx: /^K7/,
				dxName: "Liver disease",
				rx: /\b(carbamazepine|tegretol)\b/i,
				text: "Carbamazepine hepatotoxic — monitor LFTs; watch fatigue, jaundice, abdominal pain"
			},
			{
				dx: /^E1[01]/,
				dxName: "Diabetes",
				rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|haloperidol|haldol|lurasidone|latuda|asenapine|saphris|brexpiprazole|rexulti|cariprazine|vraylar|lumateperone|caplyta|iloperidone|fanapt|chlorpromazine|thorazine|fluphenazine|prolixin|perphenazine|trilafon|clozapine|clozaril)\b/i,
				text: "Antipsychotics worsen glycemic control — monitor fasting glucose/HbA1c, weight, polyuria, polydipsia"
			},
			{
				dx: /^E1[01]/,
				dxName: "Diabetes",
				rx: /\b(mirtazapine|remeron|paroxetine|paxil)\b/i,
				text: "Weight gain risk — monitor weight, glucose, increased appetite"
			},
			{
				dx: /^G40/,
				dxName: "Seizure disorder",
				rx: /\b(bupropion|wellbutrin)\b/i,
				text: "Bupropion lowers seizure threshold — CONTRAINDICATED; monitor seizure frequency"
			},
			{
				dx: /^G40/,
				dxName: "Seizure disorder",
				rx: /\b(clozapine|clozaril)\b/i,
				text: "Clozapine dose-dependent seizure risk — monitor seizure frequency"
			},
			{
				dx: /^G40/,
				dxName: "Seizure disorder",
				rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|chlorpromazine|thorazine)\b/i,
				text: "Lowers seizure threshold — monitor seizure frequency"
			},
			{
				dx: /^G40/,
				dxName: "Seizure disorder",
				rx: /\b(amitriptyline|elavil|imipramine|tofranil|clomipramine|anafranil)\b/i,
				text: "TCAs lower seizure threshold — monitor seizure frequency; consider SSRI instead"
			},
			{
				dx: /^G20/,
				dxName: "Parkinson's",
				rx: /\b(haloperidol|haldol|risperidone|risperdal|paliperidone|invega|olanzapine|zyprexa|fluphenazine|prolixin|chlorpromazine|thorazine|perphenazine|trilafon)\b/i,
				text: "Dopamine blockade worsens parkinsonism — monitor rigidity, tremor, bradykinesia, gait; prefer quetiapine/clozapine"
			},
			{
				dx: /^F03|^G30|^G31/,
				dxName: "Dementia",
				rx: /\b(olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|haloperidol|haldol|ziprasidone|geodon)\b/i,
				text: "Antipsychotic in dementia: increased mortality/stroke — document indication, lowest dose/duration; monitor sedation, falls, EPS"
			},
			{
				dx: /^F03|^G30|^G31/,
				dxName: "Dementia",
				rx: /\b(oxybutynin|ditropan|tolterodine|detrol|solifenacin|vesicare|amitriptyline|elavil|paroxetine|paxil|diphenhydramine|benadryl)\b/i,
				text: "Anticholinergics worsen cognition — monitor confusion, memory, urinary retention, constipation"
			},
			{
				dx: /^I10/,
				dxName: "Hypertension",
				rx: /\b(venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta|levomilnacipran|fetzima)\b/i,
				text: "SNRIs raise BP dose-dependently — monitor BP, headache, chest pain"
			},
			{
				dx: /^I10/,
				dxName: "Hypertension",
				rx: /\b(bupropion|wellbutrin)\b/i,
				text: "Bupropion may raise BP — monitor BP, headache"
			},
			{
				dx: /^I95/,
				dxName: "Hypotension",
				rx: /\b(quetiapine|seroquel|clozapine|clozaril|risperidone|risperdal|prazosin|minipress|trazodone|desyrel)\b/i,
				text: "Orthostasis risk — monitor orthostatic vitals, dizziness, falls, syncope"
			},
			{
				dx: /^I95/,
				dxName: "Hypotension",
				rx: /\b(amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|doxepin|sinequan)\b/i,
				text: "TCAs: orthostasis — monitor orthostatics, dizziness, falls"
			},
			{
				dx: /^I45\.8|^I49/,
				dxName: "Cardiac conduction/QT risk",
				rx: /\b(citalopram|celexa|escitalopram|lexapro)\b/i,
				text: "QT prolongation — monitor EKG; watch syncope, palpitations"
			},
			{
				dx: /^I45\.8|^I49/,
				dxName: "Cardiac conduction/QT risk",
				rx: /\b(ziprasidone|geodon|haloperidol|haldol|thioridazine|mellaril|chlorpromazine|thorazine)\b/i,
				text: "QT prolongation — monitor EKG; watch syncope, palpitations"
			},
			{
				dx: /^D6[89]|^Z79\.01/,
				dxName: "Bleeding risk/anticoagulated",
				rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox|venlafaxine|effexor|desvenlafaxine|pristiq|duloxetine|cymbalta)\b/i,
				text: "SSRIs/SNRIs impair platelet function — monitor bruising, petechiae, GI bleed, Hgb"
			},
			{
				dx: /^E87\.1/,
				dxName: "Hyponatremia",
				rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|luvox|venlafaxine|effexor|duloxetine|cymbalta)\b/i,
				text: "SIADH risk — monitor sodium, confusion, lethargy, falls; hold if Na <130"
			},
			{
				dx: /^E87\.1/,
				dxName: "Hyponatremia",
				rx: /\b(carbamazepine|tegretol|oxcarbazepine|trileptal)\b/i,
				text: "SIADH risk — monitor sodium, confusion"
			},
			{
				dx: /^E0[03]/,
				dxName: "Thyroid disorder",
				rx: /\blithium\b/i,
				text: "Lithium causes hypothyroidism — monitor TSH, fatigue, cold intolerance, weight gain"
			},
			{
				dx: /^N40/,
				dxName: "BPH",
				rx: /\b(amitriptyline|elavil|nortriptyline|pamelor|imipramine|tofranil|olanzapine|zyprexa|quetiapine|seroquel|paroxetine|paxil)\b/i,
				text: "Anticholinergic urinary retention — monitor hesitancy, weak stream, retention, UTIs"
			},
			{
				dx: /^K59\.0/,
				dxName: "Constipation",
				rx: /\b(clozapine|clozaril)\b/i,
				text: "Clozapine: severe constipation/ileus — monitor bowel movements daily; prophylactic laxatives"
			},
			{
				dx: /^G47\.3/,
				dxName: "Sleep apnea",
				rx: /\b(clonazepam|klonopin|lorazepam|ativan|alprazolam|xanax|diazepam|valium|zolpidem|ambien|eszopiclone|lunesta)\b/i,
				text: "Sedatives worsen apnea — monitor daytime sleepiness, morning headache, O2 desats"
			},
			{
				dx: /^J4[34]/,
				dxName: "COPD",
				rx: /\b(clonazepam|klonopin|lorazepam|ativan|alprazolam|xanax|diazepam|valium)\b/i,
				text: "Benzos: respiratory depression in COPD — monitor O2 sats, respiratory rate, sedation"
			},
			{
				dx: /^F31/,
				dxName: "Bipolar disorder",
				rx: /\b(sertraline|zoloft|escitalopram|lexapro|citalopram|celexa|fluoxetine|prozac|paroxetine|paxil|venlafaxine|effexor|duloxetine|cymbalta|bupropion|wellbutrin)\b/i,
				text: "Antidepressant alone may induce mania — monitor decreased sleep, pressured speech, impulsivity, grandiosity; ensure mood stabilizer co-prescribed"
			}
		];
		var LITHIUM_RE = /\blithium\b/i;
		var VALPROATE_RE = /\b(valpro|divalproex|depakote)/i;
		var SEIZURE_RISK_DRUGS = /\b(bupropion|wellbutrin|clozapine|clozaril)/i;
		var GLAUCOMA_RISK_DRUGS = new RegExp(ANTICHOLINERGIC.source + "|" + ORTHOSTATIC.source, "i");
		var SEDATING_DRUGS = new RegExp(BENZO.source + "|" + ZDRUG.source + "|" + OPIOID.source, "i");
		var CKD_RE = /^(N18|N19)/;
		var LIVER_RE = /^(K7[0-7])/;
		var SEIZURE_DX_RE = /^(G40)/;
		var DIABETES_RE = /^(E10|E11)/;
		var GLAUCOMA_DX_RE = /^(H402)/;
		var SLEEP_APNEA_RE = /^(G473)/;
		var PARKINSONS_RE = /^(G20)/;
		var patientFlags = {};
		var SEVERITY = {
			"Multiple SSRIs": "LOW",
			"antidepressants": "LOW",
			"Bleed risk": "MEDIUM",
			"Serotonin syndrome": "HIGH",
			"QTc prolongation": "MEDIUM",
			"Sedation": "HIGH",
			"Risk for falls": "MEDIUM",
			"kidney disease": "HIGH",
			"liver disease": "HIGH",
			"seizure disorder": "HIGH",
			"diabetes": "MEDIUM",
			"glaucoma": "HIGH",
			"sleep apnea": "HIGH",
			"Parkinson's": "HIGH",
			"Beers:": "MEDIUM",
			"UTI": "LOW"
		};
		function severityFor(reason) {
			for (var k in SEVERITY) if (reason.indexOf(k) !== -1) return SEVERITY[k];
			return "MEDIUM";
		}
		var RATIONALE_SENTENCES = {
			"falls": [
				"Fall risk increased by [meds]; reviewed with nursing team. Fall precautions reinforced and documented.",
				"[Meds] contribute to fall risk in this elderly resident. Benefit for [indication] outweighs risk at this time; monitoring gait and balance.",
				"Polypharmacy fall risk noted ([meds]). Non-pharmacologic fall prevention strategies in place."
			],
			"bleed": ["Bleed risk from [meds]; monitoring for signs of bleeding. GI prophylaxis considered.", "Combination of [meds] increases bleeding risk. Risks discussed; will monitor hemoglobin and stool guaiac as indicated."],
			"serotonin": ["Serotonin syndrome risk from [meds]; team educated on signs (agitation, clonus, hyperthermia, rigidity). Monitoring.", "Multiple serotonergic agents ([meds]); risk/benefit reviewed. Will monitor for serotonin toxicity."],
			"qtc": ["QTc prolongation risk with [meds]; baseline EKG reviewed. Monitoring for cardiac symptoms and electrolyte abnormalities.", "[Meds] may prolong QTc. Risk discussed; avoiding additional QTc-prolonging agents."],
			"sedation": ["Sedating medications ([meds]); monitoring for oversedation and daytime somnolence. Dosing timed to minimize functional impact.", "Sedation risk from [meds] reviewed with team. Fall precautions in place due to sedation."],
			"beers_anticholinergic": ["Per Beers Criteria, [meds] has strong anticholinergic properties — avoid in elderly due to cognitive impairment, delirium, and fall risk. Rationale for continued use: [indication]. Monitoring for confusion and urinary retention.", "Anticholinergic burden from [meds] noted (Beers Criteria). Benefit for [indication] outweighs risk; will reassess need regularly."],
			"beers_benzo": ["Benzodiazepine ([meds]) flagged per Beers Criteria — increased fall, fracture, and cognitive impairment risk in elderly. Indicated for [indication]; using lowest effective dose. Tapering to be considered at each visit.", "Continued benzodiazepine after risk/benefit review; resident stable on current regimen. Fall precautions in place."],
			"beers_zdrug": ["Non-benzodiazepine hypnotic ([meds]) flagged per Beers Criteria — similar adverse effects to benzodiazepines in elderly (delirium, falls, fractures). Indicated for [indication]; using lowest effective dose for shortest duration.", "Z-drug continued for insomnia refractory to sleep hygiene measures. Monitoring for daytime sedation and falls."],
			"beers_nsaid": ["NSAID ([meds]) flagged per Beers Criteria — avoid chronic use in elderly due to GI bleed, renal injury, and cardiovascular risk. Rationale: [indication]. Using lowest effective dose; GI prophylaxis considered.", "Chronic NSAID use in elderly noted (Beers Criteria). Monitoring renal function and for GI symptoms."],
			"beers_antipsychotic": [
				"Per Beers Criteria, antipsychotic ([meds]) in elderly requires documented rationale: indicated for [psychosis/agitation] refractory to non-pharmacologic interventions. Risks of stroke, mortality, and metabolic effects reviewed. GDR to be attempted as tolerated.",
				"Antipsychotic continued in elderly resident; risks of cerebrovascular events and mortality reviewed per Beers Criteria. Benefit for target symptoms outweighs risk at this time. Will reassess need at each visit.",
				"In dementia, antipsychotic ([meds]) for behavioral disturbances requires documented rationale per Beers Criteria: severe symptoms refractory to non-pharmacologic measures. Risks/benefits discussed; informed consent obtained. Monitoring for EPS and sedation."
			],
			"diabetes": ["Antipsychotic ([meds]) may worsen glycemic control in diabetes; monitoring weight, glucose, and lipids per guidelines.", "Metabolic risk from [meds] in diabetic resident noted. Coordinating with primary team on glucose monitoring."],
			"parkinsons": ["Antipsychotic ([meds]) may worsen Parkinsonian symptoms; using lowest effective dose. Monitoring movement symptoms.", "Dopamine-blocking agent ([meds]) in Parkinson's disease — risk/benefit reviewed. Will monitor for worsening rigidity and bradykinesia."],
			"kidney": ["Lithium in kidney disease ([meds]); dose adjusted for renal function. Monitoring levels and renal labs.", "Nephrotoxic risk from [meds] in CKD noted. Renal function to be monitored closely."],
			"liver": ["Valproate in liver disease ([meds]); monitoring LFTs. Dose adjusted as needed.", "Hepatotoxic risk from [meds] noted. Liver function to be followed."],
			"seizure": ["[Meds] lowers seizure threshold in resident with seizure disorder; risk/benefit reviewed. Monitoring for seizure activity.", "Seizure threshold concern with [meds]; team educated on seizure precautions."],
			"glaucoma": ["Anticholinergic ([meds]) in narrow-angle glaucoma — avoid; risk of acute angle closure. Alternative agents considered.", "[Meds] contraindicated in narrow-angle glaucoma per Beers Criteria. Discontinuation planned."],
			"sleepapnea": ["Sedating medication ([meds]) in sleep apnea — breathing risk. Using lowest effective dose; monitoring respiratory status.", "[Meds] may worsen sleep apnea; sleep hygiene and positional measures reinforced."],
			"uti": ["Resident appears to be treated for UTI ([meds]); will monitor response and review culture results when available.", "UTI treatment with [meds] noted; monitoring for symptom resolution and adverse effects."],
			"general": ["Medication warning ([meds]) reviewed; risk/benefit discussed with care team. Monitoring as indicated.", "[Meds] flagged for review; rationale for continued use documented. Will reassess at each visit."]
		};
		function rationaleKeyFor(reason) {
			var r = reason.toLowerCase();
			if (r.indexOf("beers: anticholinergic") !== -1) return "beers_anticholinergic";
			if (r.indexOf("beers: benzodiazepine") !== -1) return "beers_benzo";
			if (r.indexOf("beers: z-drug") !== -1) return "beers_zdrug";
			if (r.indexOf("beers: nsaid") !== -1) return "beers_nsaid";
			if (r.indexOf("beers: antipsychotic") !== -1) return "beers_antipsychotic";
			if (r.indexOf("falls") !== -1) return "falls";
			if (r.indexOf("bleed") !== -1) return "bleed";
			if (r.indexOf("serotonin") !== -1) return "serotonin";
			if (r.indexOf("qtc") !== -1) return "qtc";
			if (r.indexOf("sedation") !== -1 || r.indexOf("breathing risk") !== -1) return "sedation";
			if (r.indexOf("diabetes") !== -1) return "diabetes";
			if (r.indexOf("parkinson") !== -1) return "parkinsons";
			if (r.indexOf("kidney") !== -1) return "kidney";
			if (r.indexOf("liver") !== -1) return "liver";
			if (r.indexOf("seizure") !== -1) return "seizure";
			if (r.indexOf("glaucoma") !== -1) return "glaucoma";
			if (r.indexOf("sleep apnea") !== -1) return "sleepapnea";
			if (r.indexOf("uti") !== -1) return "uti";
			return "general";
		}
		var COLOR_PSYCH = {
			border: "#2563eb",
			bg: "rgba(37,99,235,0.10)"
		};
		var COLOR_LOW = {
			border: "#a16207",
			bg: "rgba(161,98,7,0.10)"
		};
		var COLOR_MEDIUM = {
			border: "#9a3412",
			bg: "rgba(154,52,18,0.14)"
		};
		var COLOR_HIGH = {
			border: "#b91c1c",
			bg: "rgba(185,28,28,0.24)"
		};
		var COLOR_UTI = {
			border: "#0d9488",
			bg: "rgba(13,148,136,0.14)"
		};
		function colorFor(sev) {
			return sev === "HIGH" ? COLOR_HIGH : sev === "LOW" ? COLOR_LOW : COLOR_MEDIUM;
		}
		var DX_FRAME = /diagnos/i;
		var RELATED_G = /^(G30|G31|G240|G251|G257|G211|G47(?!3))/;
		var RELATED_R = /^(R41|R44|R45|R46|R630)/;
		var CODE_RE = /\b[A-TV-Z][0-9][0-9AB]\b(?:\.[0-9A-Z]{1,4})?/g;
		var MEDLIST = [];
		function addMeds(ind, tier, list) {
			list.forEach(function(m) {
				MEDLIST.push({
					rx: new RegExp("\\b(" + m[0] + ")\\b", "i"),
					name: m[1],
					ind: m[2] || ind,
					tier
				});
			});
		}
		addMeds("depression", 0, [
			["fluoxetine|prozac", "Prozac"],
			["sertraline|zoloft", "Zoloft"],
			["paroxetine|paxil", "Paxil"],
			["escitalopram|lexapro", "Lexapro"],
			["citalopram|celexa", "Celexa"],
			["fluvoxamine|luvox", "Luvox"],
			["vilazodone|viibryd", "Viibryd"],
			["desvenlafaxine|pristiq", "Pristiq"],
			["venlafaxine|effexor", "Effexor"],
			["duloxetine|cymbalta", "Cymbalta"],
			["levomilnacipran|fetzima", "Fetzima"],
			["milnacipran|savella", "Savella"],
			["vortioxetine|trintellix", "Trintellix"],
			["auvelity", "Auvelity ER"],
			["bupropion|wellbutrin", "Wellbutrin"],
			["mirtazapine|remeron", "Remeron"],
			["trazodone|desyrel", "Trazodone"],
			["nefazodone|serzone", "Serzone"],
			["mianserin|tolvon", "Tolvon"],
			["agomelatine|valdoxan", "Valdoxan"],
			["reboxetine|edronax", "Edronax"],
			["tianeptine|stablon", "Stablon"],
			["gepirone|exxua", "Exxua"],
			["esketamine|spravato", "Spravato"],
			["ketamine", "ketamine"],
			["brexanolone|zulresso", "Zulresso"],
			["zuranolone|zurzuvae", "Zurzuvae"],
			["amitriptyline|elavil", "Elavil"],
			["nortriptyline|pamelor", "nortriptyline"],
			["imipramine|tofranil", "Tofranil"],
			["desipramine|norpramin", "Norpramin"],
			["clomipramine|anafranil", "Anafranil"],
			["doxepin|sinequan|silenor", "doxepin"],
			["trimipramine|surmontil", "Surmontil"],
			["protriptyline|vivactil", "Vivactil"],
			["amoxapine|asendin", "Asendin"],
			["maprotiline|ludiomil", "Ludiomil"],
			["lofepramine|gamanil", "Gamanil"],
			["dosulepin|dothiepin|prothiaden", "Prothiaden"],
			["phenelzine|nardil", "Nardil"],
			["tranylcypromine|parnate", "Parnate"],
			["isocarboxazid|marplan", "Marplan"],
			["selegiline|emsam", "Emsam"],
			["moclobemide|manerix", "Manerix"]
		]);
		addMeds("psychosis", 0, [
			["haloperidol|haldol", "Haldol"],
			["chlorpromazine|thorazine", "Thorazine"],
			["fluphenazine|prolixin|modecate", "Prolixin"],
			["perphenazine|trilafon", "Trilafon"],
			["trifluoperazine|stelazine", "Stelazine"],
			["thioridazine|mellaril", "Mellaril"],
			["thiothixene|navane", "Navane"],
			["loxapine|loxitane", "Loxitane"],
			["molindone|moban", "Moban"],
			["pimozide|orap", "Orap"],
			["flupentixol|fluanxol", "Fluanxol"],
			["zuclopenthixol|clopixol", "Clopixol"],
			["sulpiride|dogmatil", "Dogmatil"],
			["mesoridazine|serentil", "Serentil"],
			["clozapine|clozaril", "Clozaril"],
			["risperidone|risperdal|rykindo|perseris|uzedy|risvan", "Risperdal"],
			["olanzapine|zyprexa", "Zyprexa"],
			["quetiapine|seroquel", "Seroquel"],
			["ziprasidone|geodon", "Geodon"],
			["aripiprazole|abilify|aristada|asimtufii", "Abilify"],
			["paliperidone|invega|erzofri", "Invega"],
			["asenapine|saphris", "Saphris"],
			["iloperidone|fanapt", "Fanapt"],
			["lurasidone|latuda", "Latuda"],
			["brexpiprazole|rexulti", "Rexulti"],
			["cariprazine|vraylar", "Vraylar"],
			["lumateperone|caplyta", "Caplyta"],
			["pimavanserin|nuplazid", "Nuplazid"],
			["amisulpride|solian", "Solian"],
			["zotepine|nipolept", "Nipolept"],
			["sertindole|serdolect", "Serdolect"],
			["xanomeline|cobenfy", "Cobenfy"],
			["periciazine|neulactil", "Neulactil"],
			["pipotiazine|piportil", "Piportil"],
			["levomepromazine|methotrimeprazine|nozinan", "Nozinan"],
			["promazine|sparine", "Sparine"],
			["acetophenazine|tindal", "Tindal"],
			["carphenazine|proketazine", "Proketazine"],
			["remoxipride|roxiam", "Roxiam"]
		]);
		addMeds("mood", 0, [
			["lithium|lithobid|eskalith", "Lithium"],
			["divalproex|valproate|valproic|depakote|depakene", "Depakote"],
			["carbamazepine|tegretol", "Tegretol"],
			["oxcarbazepine|trileptal", "Trileptal"],
			["lamotrigine|lamictal", "Lamictal"],
			["topiramate|topamax", "Topamax"]
		]);
		addMeds("anxiety", 0, [
			["alprazolam|xanax", "Xanax"],
			["lorazepam|ativan", "Ativan"],
			["clonazepam|klonopin", "Klonopin"],
			["diazepam|valium", "Valium"],
			["chlordiazepoxide|librium", "Librium"],
			["oxazepam|serax", "Serax"],
			["clorazepate|tranxene", "Tranxene"],
			["bromazepam|lexotan", "Lexotan"],
			["prazepam|centrax", "Centrax"],
			["halazepam|paxipam", "Paxipam"],
			["medazepam", "medazepam"],
			["clobazam|onfi", "Onfi"],
			["buspirone|buspar", "Buspar"],
			["meprobamate|miltown", "Miltown"]
		]);
		addMeds("insomnia", 0, [
			["temazepam|restoril", "Restoril"],
			["flurazepam|dalmane", "Dalmane"],
			["triazolam|halcion", "Halcion"],
			["estazolam|prosom", "ProSom"],
			["quazepam|doral", "Doral"],
			["nitrazepam|mogadon", "Mogadon"],
			["lormetazepam|noctamid", "Noctamid"],
			["loprazolam", "loprazolam"],
			["flunitrazepam|rohypnol", "Rohypnol"],
			["zolpidem|ambien", "Ambien"],
			["zaleplon|sonata", "Sonata"],
			["eszopiclone|lunesta", "Lunesta"],
			["zopiclone|imovane", "Imovane"],
			["ramelteon|rozerem", "Ramelteon"],
			["tasimelteon|hetlioz", "Hetlioz"],
			["suvorexant|belsomra", "Belsomra"],
			["lemborexant|dayvigo", "Dayvigo"],
			["daridorexant|quviviq", "Quviviq"],
			[
				"melatonin",
				"Melatonin",
				"poor sleep"
			],
			["chloral hydrate", "chloral hydrate"]
		]);
		addMeds("ADHD", 0, [
			["lisdexamfetamine|vyvanse", "Vyvanse"],
			["amphetamine|adderall|mydayis", "Adderall"],
			["dextroamphetamine|dexedrine", "Dexedrine"],
			["dexmethylphenidate|focalin", "Focalin"],
			["methylphenidate|ritalin|concerta|metadate|quillivant|daytrana", "methylphenidate"],
			["methamphetamine|desoxyn", "Desoxyn"],
			["atomoxetine|strattera", "Strattera"],
			["viloxazine|qelbree", "Qelbree"],
			["guanfacine|intuniv|tenex", "guanfacine"]
		]);
		addMeds("EPS", 1, [
			["benztropine|cogentin", "Cogentin"],
			["trihexyphenidyl|artane", "Artane"],
			["procyclidine|kemadrin", "Kemadrin"],
			["biperiden|akineton", "Akineton"],
			["amantadine|symmetrel|gocovri|osmolex", "Amantadine"]
		]);
		addMeds("dementia", 0, [
			["donepezil|aricept", "Aricept"],
			["rivastigmine|exelon", "Rivastigmine"],
			["galantamine|razadyne", "Razadyne"],
			["memantine|namenda", "Namenda"],
			["tacrine|cognex", "Cognex"]
		]);
		addMeds("tardive dyskinesia", 1, [
			["deutetrabenazine|austedo", "Austedo"],
			["valbenazine|ingrezza", "Ingrezza"],
			["tetrabenazine|xenazine", "Xenazine"]
		]);
		addMeds("substance use", 1, [
			["buprenorphine\\b.*\\bnaloxone|suboxone", "Suboxone"],
			["buprenorphine|subutex|sublocade", "Subutex"],
			["methadone|dolophine", "methadone"],
			["naltrexone|revia|vivitrol", "naltrexone"],
			["acamprosate|campral", "Campral"],
			["disulfiram|antabuse", "Antabuse"],
			["nalmefene|selincro", "Selincro"],
			["varenicline|chantix", "Chantix"],
			["chlormethiazole|heminevrin", "Heminevrin"]
		]);
		var IND_NORM = {
			"depression": "depression",
			"major depressive disorder": "depression",
			"major depression": "depression",
			"recurrent depression": "depression",
			"sleep disorder": "insomnia",
			"sleep": "insomnia",
			"insomnia": "insomnia",
			"parancia": "paranoia",
			"paranoia": "paranoia",
			"anxiety": "anxiety",
			"anxiety disorder": "anxiety",
			"generalized anxiety disorder": "anxiety",
			"axiety": "anxiety",
			"axiety disorder": "anxiety",
			"psychosis": "psychosis",
			"psychotic disorder": "psychosis",
			"schizophrenia": "schizophrenia",
			"schizoaffective disorder": "schizophrenia",
			"bipolar": "bipolar",
			"bipolar disorder": "bipolar",
			"bipolar i disorder": "bipolar",
			"bipolar ii disorder": "bipolar",
			"bipolar affective disorder": "bipolar",
			"mood disorder": "mood",
			"adhd": "ADHD",
			"extrapyramidal and movement disorder": "EPS",
			"extrapyramidal disorder": "EPS",
			"convulsions": "seizures",
			"unspecified convulsions": "seizures",
			"tourette's disorder": "tourette's disorder",
			"tourettes disorder": "tourette's disorder"
		};
		var FORCED_IND = {
			"Namenda": "dementia",
			"Aricept": "dementia",
			"Rivastigmine": "dementia",
			"Razadyne": "dementia",
			"Melatonin": "sleep",
			"Remeron": "depression",
			"Trazodone": "depression",
			"Ambien": "insomnia",
			"Xanax": "anxiety",
			"Ativan": "anxiety",
			"Klonopin": "anxiety",
			"Valium": "anxiety",
			"Librium": "anxiety",
			"Serax": "anxiety",
			"Tranxene": "anxiety",
			"Lexotan": "anxiety",
			"Centrax": "anxiety",
			"Paxipam": "anxiety",
			"medazepam": "anxiety",
			"Onfi": "anxiety"
		};
		function matchMed(line) {
			for (var i = 0; i < MEDLIST.length; i++) if (MEDLIST[i].rx.test(line)) return MEDLIST[i];
			return null;
		}
		function fmtNum(n) {
			return n.toFixed(3).replace(/\.?0+$/, "");
		}
		function parseQty(s) {
			if (s == null) return null;
			s = s.replace("½", "0.5").replace("¼", "0.25").replace("¾", "0.75");
			var m = s.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
			if (m) return +m[2] ? +m[1] / +m[2] : null;
			if (/^\s*\d*\.?\d+\s*$/.test(s)) return +s;
			return null;
		}
		function normUnit(u) {
			u = u.toLowerCase();
			if (/^(mg|milligram)/.test(u)) return "mg";
			if (/^(mcg|microgram)/.test(u)) return "mcg";
			if (/^(g|gram)/.test(u)) return "g";
			return u;
		}
		function freqOf(t) {
			var hm = t.match(/\b(?:every|q)\s*(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(?:hours?|hrs?|h)\b/i);
			if (hm) return "q" + hm[1] + (hm[2] ? "-" + hm[2] : "") + "h";
			var m = t.match(/\b(every\s+\d+(?:\s*(?:-|–|to)\s*\d+)?\s*(?:hour|hr|day|week|wk|month|mo|year|yr)s?(?:\(s\))?)/i);
			if (m) return m[1].toLowerCase().replace(/\s+/g, " ");
			m = t.match(/\b(every\s+(?:week|month|year)s?)\b/i);
			if (m) return m[1].toLowerCase().replace(/\s+/g, " ");
			if (/\bmonthly\b/i.test(t)) return "monthly";
			if (/\bweekly\b/i.test(t)) return "weekly";
			var l = t.toLowerCase();
			var lNoNeg = l.replace(/\b(?:it\s+is\s+)?not\s+(?:a\s+)?prn\b/g, "").replace(/\bno\s+prn\b/g, "");
			if (!/\bmorning\b|\bbed\s?time\b|\bnight\b|\bevening\b|\bdaily\b|\btimes a day\b|\bevery\s|\bq\d|\bbid\b|\btid\b|\bqid\b|\bqhs\b|\bqam\b|\bqpm\b|\bweekly\b|\bmonthly\b/.test(l) && /\bas needed\b|\bp\.r\.n\.?\b|\bprn\b/.test(lNoNeg)) return "PRN";
			if (/\bbefore meals?\b|\bante cibum\b|\ba\.c\.?|\bac\b/.test(l)) return "AC";
			if (/\bafter meals?\b|\bpost cibum\b|\bp\.c\.?|\bpc\b/.test(l)) return "PC";
			var hasAM = /\bmorning\b|\bqam\b|\bevery day\b|\bdaily\b/.test(l);
			var hasPM = /\bbed\s?time\b|\bnight\b|\bevening\b|\bqhs\b/.test(l);
			if (hasAM && hasPM && !/\bonce\b/.test(l)) return "BID";
			if (/\bbed\s?time\b|\bat night\b|\bnightly\b|\bevery night\b|\bone time a night\b|\b1 time a night\b|\bonce nightly\b|\bbefore bed\b|\bin the evening\b|\bhora somni\b|\bh\.s\.?|\bhs\b|\bqhs\b/.test(l)) return "QHS";
			if (/\bevery other day\b|\bqod\b/.test(l)) return "QOD";
			if (/\btwo times a day\b|\btwice a day\b|\btwice daily\b|\bb\.i\.d\.?|\bbid\b|\b2 times a day\b/.test(l)) return "BID";
			if (/\bthree times a day\b|\bthrice\b|\bt\.i\.d\.?|\btid\b|\b3 times a day\b/.test(l)) return "TID";
			if (/\bfour times a day\b|\bq\.i\.d\.?|\bqid\b|\b4 times a day\b/.test(l)) return "QID";
			if (/\bevery morning\b|\beach morning\b|\bin the morning\b|\bqam\b/.test(l)) return "QAM";
			if (/\bevery evening\b|\bqpm\b/.test(l)) return "QPM";
			if (/\bone[ -]time only\b|\bone[ -]time dose\b|\bsingle dose\b/.test(l)) return "ONCE";
			if (/\bone time a day\b|\bonce a day\b|\bonce daily\b|\bevery day\b|\bdaily\b|\bq\.d\.?|\bqd\b|\bq day\b|\b1 time a day\b/.test(l)) return "QD";
			return "";
		}
		function routeOf(t) {
			t = t.toLowerCase();
			if (/\bintramuscular(?:ly)?\b|\bi\.m\.?\b/.test(t)) return "IM";
			if (/\bsubcutaneous(?:ly)?\b|\bsub-?q\b|\bsubcut\b/.test(t)) return "SC";
			if (/\bintravenous(?:ly)?\b|\bi\.v\.?\b/.test(t)) return "IV";
			if (/\bsublingual(?:ly)?\b/.test(t)) return "SL";
			if (/\brectal(?:ly)?\b|\bper rectum\b/.test(t)) return "PR";
			if (/\btransdermal(?:ly)?\b|\bpatch\b/.test(t)) return "TD";
			if (/^\s*inject\b/.test(t)) return "IM";
			return "";
		}
		function isLiquid(h) {
			return /\b(concentrate|solution|suspension|elixir|syrup|oral liquid|liquid|tincture|drops)\b/i.test(h);
		}
		function indicationOf(t, def) {
			var m, raw = null;
			if (m = t.match(/\brelated to\s+(.+)$/is)) raw = m[1];
			else if (m = t.match(/\bfor\s+(.+)$/is)) raw = m[1];
			if (raw === null) return def;
			raw = raw.replace(/[\t\r\n].*$/s, "");
			raw = raw.replace(/\*+.*$/, "");
			raw = raw.replace(/\s+(?:to\s+)?add\s+in\b.*$/i, "");
			raw = raw.replace(/\s+with\s+(?:\S+\s+)?\d+(?:\.\d+)?\s*(?:mg|mcg|g)\b.*$/i, "");
			raw = raw.replace(/\s+(?:related to|addition to|in addition|along with|to give|and give|give|total of|total\s+\d|by mouth|orally|po|sublingual|tablets?|capsules?|caps?|\d+\s*\/\s*\d+|[½¼¾]|\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g)\b).*$/i, "");
			raw = raw.replace(/\s*\([^)]*\)\s*$/, "");
			raw = raw.replace(/,.*$/, "");
			raw = raw.replace(/\s*\(\s*[A-Z]\d{2}(?:\.[0-9A-Z]{1,4})?\s*\)/g, "");
			raw = raw.replace(/\s+(?:in the (?:morning|afternoon|evening)|at bed\s?time|at night)\b.*$/i, "");
			raw = raw.replace(/\s+without\s+behaviou?ral\b.*$/i, "");
			raw = raw.replace(/^for\s+/i, "");
			raw = raw.replace(/^\s*(?:other|unspecified|acute|chronic|mild|moderate|severe)\s+/i, "");
			raw = raw.replace(/\s+(?:to|in|for|with|and)\s*$/i, "");
			raw = raw.replace(/^\s+|\s+$/g, "");
			if (!raw.length) return def;
			var key = raw.toLowerCase().replace(/\bd\/o\b/g, "disorder");
			if (IND_NORM.hasOwnProperty(key)) return IND_NORM[key];
			var primary = key.split(/\s+(?:for|and)\s+/)[0].replace(/^\s+|\s+$/g, "");
			if (/^(?:the\s+)?(?:resident|residents|patient|patients)$/.test(primary)) return def;
			primary = primary.replace(/^(?:the\s+)?(?:resident|patient)\s+(?:with\s+)?/, "");
			if (!primary) return def;
			return IND_NORM.hasOwnProperty(primary) ? IND_NORM[primary] : primary;
		}
		function headerText(g) {
			return g.rows[0].innerText.replace(/\s+/g, " ").trim();
		}
		function instrText(g) {
			for (var i = 1; i < g.rows.length; i++) {
				var t = (g.rows[i].textContent || "").replace(/\s+/g, " ").trim();
				if (/^(?:Give|Inject|Take|Apply|Instill|Insert|Place|Infuse|Administer)\b/i.test(t)) return t;
			}
			return "";
		}
		function buildMedList(groups) {
			var rows = [];
			groups.forEach(function(g) {
				var hdr = headerText(g);
				if (!/\bActive\b/i.test(hdr + " " + (g.rows[0].textContent || ""))) return;
				var med = matchMed(hdr);
				if (!med) return;
				var instr = instrText(g);
				var comboDose = null;
				var cdm = hdr.match(/(\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g))\b/i);
				if (cdm) comboDose = cdm[1].replace(/\s+/g, " ").trim().toUpperCase();
				var ustr = null, uunit = null, cnum = null, cunit = null, cden = 1, m;
				if (m = hdr.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b(?!\s*\/)/i)) {
					ustr = m[1];
					uunit = m[2].toLowerCase();
				}
				if (m = hdr.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g)\s*\/\s*(\d+(?:\.\d+)?)?\s*ml\b/i)) {
					cnum = m[1];
					cunit = m[2].toLowerCase();
					cden = m[3] ? m[3] : 1;
				}
				var rt = routeOf(instr);
				var disp = med.name + (isLiquid(hdr) && rt === "" ? " liquid" : "");
				var ind = indicationOf(instr, med.ind);
				if (FORCED_IND.hasOwnProperty(med.name)) ind = FORCED_IND[med.name];
				instr.split(/\s+AND\s+(?=(?:Give|Inject|Take|Administer|Infuse|Instill|Place|Apply)\b)/i).forEach(function(seg) {
					var sdnum = null, sdunit = null, sm;
					if (sm = seg.match(/\btotal of\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b/i)) {
						sdnum = +sm[1];
						sdunit = sm[2].toLowerCase();
					} else if (sm = seg.match(/\b(?:Give|Inject|Take|Administer|Infuse|Instill)\s+(\d+(?:\.\d+)?)\s*(mg|milligrams?|mcg|micrograms?|g|grams?)\b/i)) {
						sdnum = +sm[1];
						sdunit = normUnit(sm[2]);
					} else if (ustr !== null && (sm = seg.match(/\b(?:Give|Take)\s+(\d+\s*\/\s*\d+|[½¼¾]|\d*\.?\d+)\s*(?:tablets?|capsules?|tabs?|caps?)\b/i))) {
						var q = parseQty(sm[1]);
						if (q !== null) {
							sdnum = q * +ustr;
							sdunit = uunit;
						}
					} else if (cnum !== null && (sm = seg.match(/\b(?:Give|Inject|Instill|Infuse)\s+(\d+(?:\.\d+)?)\s*(?:ml|milliliters?|cc)\b/i))) {
						sdnum = +sm[1] * (+cnum / +cden);
						sdunit = cunit;
					} else if (ustr !== null) {
						sdnum = +ustr;
						sdunit = uunit;
					}
					var sdstr = sdnum !== null ? fmtNum(sdnum) + sdunit : "";
					var sfr = freqOf(seg);
					if (sfr === "ONCE") return;
					var sraw = seg.replace(/\s+/g, " ").trim();
					rows.push({
						name: med.name,
						disp,
						dnum: sdnum,
						dunit: sdunit,
						dstr: sdstr,
						rt,
						fr: sfr,
						ind,
						tier: med.tier,
						raw: sraw,
						comboDose
					});
				});
			});
			function bucketOf(fr) {
				return fr === "QD" || fr === "QAM" || fr === "QPM" ? "QD" : fr;
			}
			var RANK = {
				QAM: 0,
				QD: 1,
				QPM: 2,
				QHS: 3
			};
			var combos = {}, order = [];
			rows.forEach(function(r) {
				var key = [
					r.name,
					r.rt,
					r.ind,
					r.disp
				].join("|");
				if (!combos[key]) {
					combos[key] = {
						r0: r,
						buckets: {},
						list: []
					};
					order.push(key);
				}
				var b = bucketOf(r.fr);
				if (!combos[key].buckets[b]) {
					combos[key].buckets[b] = [];
					combos[key].list.push(b);
				}
				combos[key].buckets[b].push(r);
			});
			var main = [], last = [], review = [], seen = {};
			order.forEach(function(key) {
				var c = combos[key];
				var bnames = c.list.slice().sort(function(a, b) {
					return (RANK[a] == null ? 4 : RANK[a]) - (RANK[b] == null ? 4 : RANK[b]);
				});
				var pairs = [];
				bnames.forEach(function(b) {
					var uniq = [], rs = {};
					c.buckets[b].forEach(function(r) {
						var rk = r.dnum + "|" + r.raw;
						if (!rs[rk]) {
							rs[rk] = 1;
							uniq.push(r);
						}
					});
					var r0 = uniq[0];
					var missing = uniq.some(function(r) {
						return r.dnum === null || r.fr === "";
					});
					var unitMismatch = uniq.some(function(r) {
						return r.dunit !== r0.dunit;
					});
					if (missing || unitMismatch) {
						uniq.forEach(function(r) {
							var why = [];
							if (r.dnum === null) why.push("dose could not be determined");
							if (r.fr === "") why.push("frequency not recognized");
							if (unitMismatch) why.push("doses use different units");
							var guess = [
								r.dstr,
								r.fr,
								"for",
								r.ind
							].filter(function(x) {
								return x.length;
							}).join(" ");
							review.push("- " + r.name + ": best guess \"" + guess + "\" — " + why.join("; ") + "\n    order: \"" + r.raw + "\"");
						});
						return;
					}
					var total = 0, statedTotal = null;
					uniq.forEach(function(r) {
						total += r.dnum;
						var tm = r.raw.match(/\btotal of\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g)\b/i);
						if (tm && Math.abs(+tm[1] - r.dnum) < .001 && tm[2].toLowerCase() === r.dunit) statedTotal = +tm[1];
					});
					if (statedTotal !== null) total = statedTotal;
					var freqDisp = uniq.length > 1 && b === "QD" ? "QD" : r0.fr;
					var dosePart = r0.comboDose ? r0.comboDose : fmtNum(total) + r0.dunit;
					pairs.push([
						dosePart,
						r0.rt,
						freqDisp
					].filter(function(x) {
						return x.length;
					}).join(" "));
				});
				if (!pairs.length) return;
				var rawNoNeg = c.r0.raw.replace(/\b(?:it\s+is\s+)?not\s+(?:a\s+)?prn\b/gi, "").replace(/\bno\s+prn\b/gi, "");
				var isPrn = /\bas\s+needed\b|\bprn\b|p\.r\.n\.|\bas\s+necessary\b|\bwhen\s+needed\b|\bif\s+needed\b/i.test(rawNoNeg);
				var freqWithPrn = pairs.join(" and ") + (isPrn && c.list.indexOf("PRN") === -1 ? " PRN" : "");
				var entry = "- " + c.r0.disp + " " + freqWithPrn + " for " + c.r0.ind;
				if (seen[entry]) return;
				seen[entry] = 1;
				(c.r0.tier === 1 ? last : main).push(entry);
			});
			function medsOrderLines(lines) {
				var buckets = [], seen = {};
				lines.forEach(function(ln, i) {
					var m = / for (.+)$/.exec(ln);
					var ind = m ? m[1].replace(/\s+/g, " ").replace(/[.\s]+$/, "").toLowerCase() : "";
					var last = /seizure|epilep|parkinson/.test(ind || ln);
					var key = (last ? "L|" : "M|") + (ind || "#" + i);
					if (!seen[key]) {
						seen[key] = [];
						buckets.push(seen[key]);
					}
					seen[key].push({
						ln,
						last
					});
				});
				var main = buckets.filter(function(b) {
					return !b[0].last;
				});
				var lastB = buckets.filter(function(b) {
					return b[0].last;
				});
				var out = [];
				main.concat(lastB).forEach(function(b) {
					b.forEach(function(it) {
						out.push(it.ln);
					});
				});
				return out;
			}
			return {
				lines: medsOrderLines(main.concat(last)),
				review
			};
		}
		function copyToClipboard(doc, text, btn) {
			function done() {
				if (btn) {
					btn.textContent = "Copied";
					setTimeout(function() {
						btn.textContent = "Copy";
					}, 1200);
				}
			}
			try {
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(text).then(done, fallback);
					return;
				}
			} catch (e) {}
			fallback();
			function fallback() {
				try {
					var ta = doc.createElement("textarea");
					ta.value = text;
					ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
					doc.body.appendChild(ta);
					ta.focus();
					ta.select();
					doc.execCommand("copy");
					doc.body.removeChild(ta);
					done();
				} catch (e) {}
			}
		}
		function esc(s) {
			return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		}
		function buildMedListHtml(res) {
			var h = "<div style=\"font-weight:bold;margin-bottom:3px;color:#1d4ed8;\">Psych med list <button class=\"pcc-fill-copy\" id=\"copyMedListBtn\" data-fill-label=\"Psych meds\" type=\"button\" style=\"margin-left:10px;padding:3px 14px;font-size:16px;font-weight:700;cursor:pointer;border:2px solid #1d4ed8;background:#1d4ed8;color:#fff;border-radius:8px;\">Copy</button></div>";
			var lines = res.lines.length ? res.lines : ["- none"];
			h += lines.map(function(l) {
				return "<div>" + esc(l) + "</div>";
			}).join("");
			if (res.review.length) {
				h += "<div style=\"margin-top:6px;font-weight:bold;color:#9a3412;\">⚠ REVIEW — interpret manually (excluded above):</div>";
				h += res.review.map(function(l) {
					return "<div style=\"white-space:pre-wrap;\">" + esc(l) + "</div>";
				}).join("");
			}
			return h;
		}
		function buildLabsData(groups) {
			var out = [];
			groups.forEach(function(g) {
				var t = g.rows[0].innerText;
				var name = shortName(g);
				var isPsych = medTierOf(t) <= 1;
				LAB_MONITORING.forEach(function(m) {
					if (m.rx.test(t)) {
						if (!out.some(function(o) {
							return o.name === name && o.labs === m.labs;
						})) out.push({
							name,
							labs: m.labs,
							psych: isPsych
						});
					}
				});
			});
			out = out.map(function(o, i) {
				return {
					o,
					i
				};
			}).sort(function(a, b) {
				return (b.o.psych ? 1 : 0) - (a.o.psych ? 1 : 0) || a.i - b.i;
			}).map(function(x) {
				return x.o;
			});
			var lines = ["Labs to monitor:"].concat(out.map(function(o) {
				return "- " + o.name + ": " + o.labs;
			}));
			return {
				items: out,
				lines
			};
		}
		function buildLabsHtml(data) {
			var h = "<div style=\"font-weight:bold;margin-bottom:4px;color:#1d4ed8;\">Labs to monitor <button id=\"copyLabsBtn\" type=\"button\" style=\"margin-left:10px;padding:3px 14px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid #1d4ed8;background:#1d4ed8;color:#fff;border-radius:8px;\">Copy</button></div>";
			if (!data.items.length) return h + "<em>No labs/monitoring needed for current meds.</em>";
			h += data.items.map(function(o) {
				return "<div style=\"margin:2px 0;\"><b>" + esc(o.name) + "</b> — " + esc(o.labs) + "</div>";
			}).join("");
			return h;
		}
		function buildWarningsData(groups, doc) {
			var out = {
				blackBox: [],
				conditions: []
			};
			var allCodes = [];
			try {
				var bodyText = doc.body ? doc.body.innerText || "" : "";
				var m, re = new RegExp(CODE_RE.source, "g");
				while (m = re.exec(bodyText)) allCodes.push(m[0].replace(".", ""));
			} catch (e) {}
			groups.forEach(function(g) {
				var t = g.rows[0].innerText;
				var name = shortName(g);
				BLACK_BOX.forEach(function(b) {
					if (b.rx.test(t)) {
						if (!out.blackBox.some(function(o) {
							return o.name === name && o.text === b.text;
						})) out.blackBox.push({
							name,
							text: b.text
						});
					}
				});
				CONDITION_WARNINGS.forEach(function(cw) {
					if (allCodes.some(function(code) {
						return cw.dx.test(code);
					}) && cw.rx.test(t)) {
						var key = cw.dxName + "|" + name;
						if (!out.conditions.some(function(o) {
							return o.key === key;
						})) out.conditions.push({
							key,
							dx: cw.dxName,
							name,
							text: cw.text
						});
					}
				});
			});
			var lines = ["Warnings:"];
			out.blackBox.forEach(function(o) {
				lines.push("- [BLACK BOX] " + o.name + ": " + o.text);
			});
			out.conditions.forEach(function(o) {
				lines.push("- [" + o.dx + "] " + o.name + ": " + o.text);
			});
			return {
				items: out,
				lines
			};
		}
		function buildWarningsHtml(data) {
			var h = "";
			var bb = data.items.blackBox, cond = data.items.conditions;
			if (!bb.length && !cond.length) return "<em>No black box or condition warnings for current meds.</em>";
			if (bb.length) {
				h += "<div style=\"font-weight:bold;margin:0 0 2px;color:#991b1b;\">Black box:</div>";
				h += bb.map(function(o) {
					return "<div style=\"margin:2px 0;\"><b>" + esc(o.name) + "</b> — " + esc(o.text) + "</div>";
				}).join("");
			}
			if (cond.length) {
				h += "<div style=\"font-weight:bold;margin:6px 0 2px;color:#991b1b;\">Condition alerts:</div>";
				h += cond.map(function(o) {
					return "<div style=\"margin:3px 0;\"><b>[" + esc(o.dx) + "]</b> <b>" + esc(o.name) + "</b><br><span style=\"margin-left:4px;\">→ " + esc(o.text) + "</span></div>";
				}).join("");
			}
			return h;
		}
		function isOn(key) {
			try {
				return localStorage.getItem(key) !== "off";
			} catch (e) {
				return true;
			}
		}
		function setOn(key, v) {
			try {
				localStorage.setItem(key, v ? "on" : "off");
			} catch (e) {}
		}
		function dashView() {
			try {
				return localStorage.getItem("tmDashView2") === "main" ? "main" : "mica";
			} catch (e) {
				return "mica";
			}
		}
		function plantViewToggle() {
			if (document.getElementById("tmViewBtn")) {
				hideDashChrome();
				return;
			}
			var tds = document.querySelectorAll("td");
			var cell = null;
			for (var i = 0; i < tds.length; i++) {
				var tx = (tds[i].textContent || "").replace(/\s+/g, " ").trim();
				if (/^Views:/.test(tx) && tx.length < 40) {
					cell = tds[i];
					break;
				}
			}
			if (!cell) return;
			var b = document.createElement("button");
			b.id = "tmViewBtn";
			b.type = "button";
			b.textContent = dashView() === "main" ? "View: Mica" : "View: Main";
			b.style.cssText = "padding:3px 12px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid #7d8f69;border-radius:6px;background:#eef2e6;color:#334155;";
			b.onclick = function() {
				var next = dashView() === "main" ? "mica" : "main";
				try {
					localStorage.setItem("tmDashView2", next);
				} catch (e) {}
				b.textContent = next === "main" ? "View: Mica" : "View: Main";
				processedSig = {};
				fit();
			};
			var placed = false;
			var pv = document.getElementById("idPrintableViewBtn");
			if (!pv) {
				var cands = document.querySelectorAll("input, button, a");
				for (var pi = 0; pi < cands.length; pi++) if ((cands[pi].value || cands[pi].textContent || "").trim() === "Printable View") {
					pv = cands[pi];
					break;
				}
			}
			if (pv && pv.parentNode) {
				pv.style.display = "none";
				pv.parentNode.insertBefore(b, pv);
				placed = true;
			}
			if (!placed) {
				var tbl = cell.closest ? cell.closest("table") : null;
				if (tbl && tbl.parentNode) {
					var host = document.createElement("div");
					host.style.cssText = "margin:2px 0 6px;";
					host.appendChild(b);
					tbl.parentNode.insertBefore(host, tbl);
				} else cell.appendChild(b);
			}
			hideDashChrome();
		}
		function hideDashChrome() {
			var links = document.querySelectorAll("a");
			for (var i = 0; i < links.length; i++) if ((links[i].textContent || "").trim() === "Resident Dashboard") {
				var dv = links[i].closest ? links[i].closest("div") : null;
				if (dv && (dv.textContent || "").length < 200) dv.style.display = "none";
				break;
			}
			var el = document.getElementById("ESOLeditLayout");
			if (el && el.closest) {
				var tr = el.closest("tr");
				if (tr && !tr.querySelector("#tmViewBtn")) tr.style.display = "none";
			}
			var tds = document.querySelectorAll("td");
			for (var j = 0; j < tds.length; j++) {
				var tx = (tds[j].textContent || "").replace(/\s+/g, " ").trim();
				if (/^Views:/.test(tx) && tx.length < 40) {
					var tb = tds[j].closest ? tds[j].closest("table") : null;
					if (tb) tb.style.display = "none";
					break;
				}
			}
		}
		function setButton(doc, id, text, onclick) {
			var b = doc.getElementById(id);
			if (!b) {
				b = doc.createElement("button");
				b.id = id;
				b.type = "button";
				b.style.cssText = "margin:0 6px 6px 0;padding:0 10px;height:26px;display:inline-flex;align-items:center;box-sizing:border-box;font-size:12px;cursor:pointer;vertical-align:top;";
				b.onclick = onclick;
				if (id === "psychToggle") {
					var medBox = doc.getElementById("medListBox");
					if (medBox && medBox.parentNode) medBox.parentNode.insertBefore(b, medBox);
					else doc.body.insertBefore(b, doc.body.firstChild);
				} else doc.body.insertBefore(b, doc.body.firstChild);
			}
			if (id === "psychToggle") b.innerHTML = text;
			else b.textContent = text;
		}
		var FLAG_BOX_CSS = "display:block;flex:0 0 calc(50% - 4px);width:calc(50% - 4px);box-sizing:border-box;padding:6px 10px;font-size:12px;border:1px solid #9a3412;background:#fff7ed;overflow-wrap:anywhere;";
		var MED_BOX_CSS = "flex:0 0 calc(50% - 4px);width:calc(50% - 4px);margin-left:auto;box-sizing:border-box;padding:6px 10px;font-size:20px;border:1px solid #2563eb;background:#eff6ff;overflow-wrap:anywhere;";
		function ensureRow(doc) {
			var row = doc.getElementById("pccTopRow");
			if (!row) {
				row = doc.createElement("div");
				row.id = "pccTopRow";
				row.style.cssText = "display:flex;gap:8px;align-items:stretch;width:100%;box-sizing:border-box;margin:0 0 6px 0;";
				var btn = doc.getElementById("interactionInfo");
				if (btn && btn.parentNode) btn.parentNode.insertBefore(row, btn.nextSibling);
				else doc.body.insertBefore(row, doc.body.firstChild);
			}
			return row;
		}
		function setBox(doc, id, css, html) {
			var row = ensureRow(doc);
			var p = doc.getElementById(id);
			if (!p) {
				p = doc.createElement("div");
				p.id = id;
				p.style.cssText = css;
				row.appendChild(p);
			}
			p.innerHTML = html;
		}
		function togglePanel(doc, id) {
			var p = doc.getElementById(id);
			if (!p) try {
				p = doc.defaultView.parent.document.getElementById(id);
			} catch (e) {}
			if (p) p.style.display = p.style.display === "none" ? "block" : "none";
		}
		function topDocOf(doc) {
			try {
				var td = doc.defaultView.parent.document;
				return td && td !== doc ? td : null;
			} catch (e) {
				return null;
			}
		}
		var BOX_IDS = [
			"interactionPanel",
			"labsBox",
			"warnBox"
		];
		function plantBoxes(doc) {
			var td = topDocOf(doc);
			if (!td) return;
			var area = td.getElementById("dragArea");
			if (!area || !area.parentNode) return;
			var row = td.getElementById("tmBoxesRow");
			if (!row) {
				row = td.createElement("div");
				row.id = "tmBoxesRow";
				row.style.cssText = "display:flex;gap:10px;align-items:stretch;width:100%;box-sizing:border-box;margin:0 0 10px 0;";
				area.parentNode.insertBefore(row, area);
			}
			BOX_IDS.forEach(function(id) {
				var fresh = doc.getElementById(id);
				var stale = td.getElementById(id);
				if (fresh) {
					if (stale && stale !== fresh) stale.remove();
					row.appendChild(fresh);
					fresh.style.flex = "1 1 0";
					fresh.style.width = "auto";
					fresh.style.minWidth = "0";
					fresh.style.marginLeft = "0";
					fresh.style.marginBottom = "0";
					fresh.style.display = "block";
				}
			});
		}
		function tidyMedsTop(doc) {
			["pccTopRow", "pccLabsRow"].forEach(function(id) {
				var r = doc.getElementById(id);
				if (r) {
					r.style.margin = "0";
					r.style.padding = "0";
				}
			});
			var bar = doc.getElementById("interactionInfo");
			var tog = doc.getElementById("psychToggle");
			if (bar && tog && bar.parentNode) {
				bar.parentNode.insertBefore(tog, bar.nextSibling);
				var sub = tog.querySelector("div");
				if (sub) sub.style.display = "none";
			}
		}
		function untidyMedsTop(doc) {
			var tog = doc.getElementById("psychToggle");
			var medBox = doc.getElementById("medListBox");
			if (tog) {
				var sub = tog.querySelector("div");
				if (sub) sub.style.display = "";
				if (medBox && medBox.parentNode) medBox.parentNode.insertBefore(tog, medBox);
			}
		}
		function pullBoxes(doc) {
			var td = topDocOf(doc);
			if (!td) return;
			BOX_IDS.forEach(function(id) {
				if (!doc.getElementById(id)) {
					var b = td.getElementById(id);
					if (b && doc.body) doc.body.appendChild(b);
				}
			});
			var row = td.getElementById("tmBoxesRow");
			if (row && !row.children.length) row.remove();
		}
		function clearRowStyle(g) {
			g.rows.forEach(function(r) {
				r.style.removeProperty("border-left");
				r.style.removeProperty("border-right");
				r.style.removeProperty("border-top");
				r.style.removeProperty("border-bottom");
				r.style.removeProperty("background-color");
				r.removeAttribute("title");
				for (var c = 0; c < r.cells.length; c++) {
					r.cells[c].style.removeProperty("border-left");
					r.cells[c].style.removeProperty("border-right");
					r.cells[c].style.removeProperty("border-top");
					r.cells[c].style.removeProperty("border-bottom");
				}
			});
		}
		function applyColor(g, c, title) {
			g.rows.forEach(function(r, i) {
				r.style.setProperty("border-left", "4px solid " + c.border, "important");
				r.style.setProperty("background-color", c.bg, "important");
				if (title && i === 0) r.title = title;
			});
		}
		function boxTier(groups, tierFilter, borderColor) {
			var tierGroups = groups.filter(function(g) {
				return typeof tierFilter === "function" ? tierFilter(g) : g.tier === tierFilter;
			});
			if (!tierGroups.length) return;
			var rows = [];
			tierGroups.forEach(function(g) {
				g.rows.forEach(function(r) {
					rows.push(r);
				});
			});
			if (!rows.length) return;
			var W = "5px solid " + borderColor;
			var lastVisible = null;
			for (var vi = rows.length - 1; vi >= 0; vi--) {
				var vr = rows[vi];
				try {
					var cs = vr.ownerDocument.defaultView.getComputedStyle(vr);
					if (cs && cs.display !== "none" && cs.visibility !== "hidden") {
						lastVisible = vr;
						break;
					}
				} catch (e) {
					lastVisible = vr;
					break;
				}
			}
			if (!lastVisible) lastVisible = rows[rows.length - 1];
			rows.forEach(function(r, idx) {
				var cells = r.cells;
				if (!cells.length) return;
				cells[0].style.setProperty("border-left", W, "important");
				cells[cells.length - 1].style.setProperty("border-right", W, "important");
				if (idx === 0) for (var c = 0; c < cells.length; c++) cells[c].style.setProperty("border-top", W, "important");
				if (r === lastVisible) for (var c2 = 0; c2 < cells.length; c2++) cells[c2].style.setProperty("border-bottom", W, "important");
			});
		}
		function filled(r) {
			var n = 0;
			for (var i = 0; i < r.cells.length; i++) if (r.cells[i].innerText.trim()) n++;
			return n;
		}
		function getMedGroups(tbody) {
			var groups = [], cur = null;
			Array.prototype.forEach.call(tbody.children, function(r) {
				if (r.tagName !== "TR") return;
				if (filled(r) >= 2) {
					cur = { rows: [r] };
					groups.push(cur);
				} else if (cur) cur.rows.push(r);
			});
			return groups;
		}
		function hash(s) {
			var h = 0;
			for (var i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
			return String(h);
		}
		function medKey(r) {
			return hash(r.innerText.replace(/\s+/g, " ").trim().slice(0, 100));
		}
		function recentlyOpened(key) {
			try {
				var m = JSON.parse(sessionStorage.getItem("pccOpened") || "{}");
				return !!(m[key] && Date.now() - m[key] < 6e4);
			} catch (e) {
				return false;
			}
		}
		function markOpened(key) {
			try {
				var m = JSON.parse(sessionStorage.getItem("pccOpened") || "{}");
				var now = Date.now();
				Object.keys(m).forEach(function(k) {
					if (now - m[k] > 6e4) delete m[k];
				});
				m[key] = now;
				sessionStorage.setItem("pccOpened", JSON.stringify(m));
			} catch (e) {}
		}
		function shouldOpen(doc, key) {
			doc.__opened = doc.__opened || {};
			return !doc.__opened[key] && !recentlyOpened(key);
		}
		function noteOpened(doc, key) {
			doc.__opened = doc.__opened || {};
			doc.__opened[key] = true;
			markOpened(key);
		}
		function isCollapsed(doc, g) {
			var d = g.rows[1];
			return !d || doc.defaultView.getComputedStyle(d).display === "none";
		}
		function findExpander(doc, r) {
			var cell = null, best = -1;
			for (var c = 0; c < Math.min(3, r.cells.length); c++) {
				var len = r.cells[c].innerText.trim().length;
				if (len > best) {
					best = len;
					cell = r.cells[c];
				}
			}
			if (!cell) return null;
			var els = cell.querySelectorAll("*");
			for (var i = 0; i < els.length; i++) {
				var e = els[i];
				if (e.innerText && e.innerText.trim()) continue;
				var a = e.closest("a");
				if (a) {
					var href = a.getAttribute("href") || "";
					if (href && !/^(#|javascript:)/i.test(href)) continue;
				}
				var pointer = doc.defaultView.getComputedStyle(e).cursor === "pointer";
				if (e.tagName === "IMG" || e.hasAttribute("onclick") || pointer || a) return a || e;
			}
			return null;
		}
		function shortName(g) {
			var r = g.rows[0], cell = null, best = -1;
			for (var c = 0; c < Math.min(3, r.cells.length); c++) {
				var len = r.cells[c].innerText.trim().length;
				if (len > best) {
					best = len;
					cell = r.cells[c];
				}
			}
			var t = (cell ? cell.innerText : r.innerText).trim().split(/\n|\t/)[0];
			var w = t.split(/[\s(]/)[0].replace(/[^A-Za-z\-]/g, "");
			return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : t.slice(0, 30);
		}
		var GENERIC_OF = {
			prozac: "fluoxetine",
			zoloft: "sertraline",
			lexapro: "escitalopram",
			celexa: "citalopram",
			paxil: "paroxetine",
			effexor: "venlafaxine",
			pristiq: "desvenlafaxine",
			cymbalta: "duloxetine",
			viibryd: "vilazodone",
			trintellix: "vortioxetine"
		};
		function canonName(g) {
			var s = shortName(g).toLowerCase();
			return GENERIC_OF[s] || s;
		}
		function flagAll(groups) {
			var ssriRows = [], adRows = [], serotRows = [], anticoagRows = [], qtcRows = [], benzoRows = [], opioidRows = [], fallRows = [];
			var lithiumRows = [], valproateRows = [], seizureDrugRows = [], antipsychoticRows = [], glaucomaRiskRows = [], sedatingRows = [];
			var beersAnticholinergicRows = [], beersBenzoRows = [], beersZdrugRows = [], beersNsaidRows = [];
			var utiTreatmentRows = [], utiSymptomRows = [], utiPossibleRows = [], utiPreventionRows = [];
			groups.forEach(function(g) {
				var t = g.rows[0].innerText;
				g.reasons = [];
				if (SSRI_ONLY.test(t)) ssriRows.push(g);
				if (ANTIDEPRESSANT.test(t)) adRows.push(g);
				if (SEROTONERGIC.test(t)) serotRows.push(g);
				if (MAOI.test(t)) g.isMAOI = true;
				if (ANTICOAG_NSAID.test(t)) anticoagRows.push(g);
				if (QTC.test(t)) qtcRows.push(g);
				if (BENZO.test(t)) benzoRows.push(g);
				if (OPIOID.test(t)) opioidRows.push(g);
				if (FALL_RISK.test(t)) fallRows.push(g);
				if (LITHIUM_RE.test(t)) lithiumRows.push(g);
				if (VALPROATE_RE.test(t)) valproateRows.push(g);
				if (SEIZURE_RISK_DRUGS.test(t)) seizureDrugRows.push(g);
				if (ANTIPSYCHOTIC.test(t)) antipsychoticRows.push(g);
				if (GLAUCOMA_RISK_DRUGS.test(t)) glaucomaRiskRows.push(g);
				if (SEDATING_DRUGS.test(t)) sedatingRows.push(g);
				if (BEERS_ANTICHOLINERGIC.test(t)) beersAnticholinergicRows.push(g);
				if (BEERS_BENZO.test(t)) beersBenzoRows.push(g);
				if (BEERS_ZDRUG.test(t)) beersZdrugRows.push(g);
				if (BEERS_NSAID.test(t)) beersNsaidRows.push(g);
				if (UTI_TREATMENT.test(t)) utiTreatmentRows.push(g);
				if (UTI_SYMPTOM.test(t)) utiSymptomRows.push(g);
				if (UTI_POSSIBLE.test(t)) utiPossibleRows.push(g);
				if (UTI_PREVENTION.test(t)) utiPreventionRows.push(g);
			});
			function flag(list, reason) {
				list.forEach(function(g) {
					if (g.reasons.indexOf(reason) === -1) g.reasons.push(reason);
				});
			}
			var uniqueSSRIs = {};
			ssriRows.forEach(function(g) {
				uniqueSSRIs[canonName(g)] = true;
			});
			if (Object.keys(uniqueSSRIs).length >= 2) flag(ssriRows, "Multiple SSRIs");
			var uniqueADs = {};
			adRows.forEach(function(g) {
				uniqueADs[canonName(g)] = true;
			});
			var uniqueADNames = Object.keys(uniqueADs);
			if (uniqueADNames.length >= 3) flag(adRows, uniqueADNames.length + " antidepressants");
			var ssriSnriRows = groups.filter(function(g) {
				return SSRI_SNRI.test(g.rows[0].innerText);
			});
			if (ssriSnriRows.length && anticoagRows.length) {
				flag(ssriSnriRows, "Bleed risk (SSRI/SNRI + NSAID/blood thinner)");
				flag(anticoagRows, "Bleed risk (SSRI/SNRI + NSAID/blood thinner)");
			}
			var maoiRows = groups.filter(function(g) {
				return g.isMAOI;
			});
			if (serotRows.length >= 2) flag(serotRows, "Serotonin syndrome risk");
			if (serotRows.length && maoiRows.length) {
				flag(serotRows, "Serotonin syndrome risk (with MAOI)");
				flag(maoiRows, "Serotonin syndrome risk (with MAOI)");
			}
			if (qtcRows.length >= 2) flag(qtcRows, "QTc prolongation");
			if (benzoRows.length && opioidRows.length) {
				flag(benzoRows, "Sedation/breathing risk (benzo + opioid)");
				flag(opioidRows, "Sedation/breathing risk (benzo + opioid)");
			}
			if (fallRows.length >= 2) flag(fallRows, "Risk for falls");
			var patientAge = getPatientAge();
			if (patientAge === null || patientAge >= 65) {
				if (beersAnticholinergicRows.length) flag(beersAnticholinergicRows, "Beers: anticholinergic — avoid in elderly");
				if (beersBenzoRows.length) flag(beersBenzoRows, "Beers: benzodiazepine — avoid in elderly");
				if (beersZdrugRows.length) flag(beersZdrugRows, "Beers: Z-drug — avoid in elderly");
				if (beersNsaidRows.length) flag(beersNsaidRows, "Beers: NSAID — avoid chronic use in elderly");
				if (antipsychoticRows.length) flag(antipsychoticRows, "Beers: antipsychotic — document rationale");
			}
			var pf = patientFlags;
			if (pf.ckd && pf.ckd.found && lithiumRows.length) flag(lithiumRows, "Lithium + kidney disease (" + pf.ckd.code + "): adjust dose, check levels");
			if (pf.liver && pf.liver.found && valproateRows.length) flag(valproateRows, "Valproate + liver disease (" + pf.liver.code + "): check LFTs");
			if (pf.seizure && pf.seizure.found && seizureDrugRows.length) flag(seizureDrugRows, "Bupropion/clozapine + seizure disorder (" + pf.seizure.code + "): lowers seizure threshold");
			if (pf.diabetes && pf.diabetes.found && antipsychoticRows.length) flag(antipsychoticRows, "Antipsychotic + diabetes (" + pf.diabetes.code + "): monitor weight, glucose, lipids");
			if (pf.glaucoma && pf.glaucoma.found && glaucomaRiskRows.length) flag(glaucomaRiskRows, "Anticholinergic/TCA + narrow-angle glaucoma (" + pf.glaucoma.code + "): avoid");
			if (pf.sleepApnea && pf.sleepApnea.found && sedatingRows.length) flag(sedatingRows, "Sedating med + sleep apnea (" + pf.sleepApnea.code + "): breathing risk");
			if (pf.parkinsons && pf.parkinsons.found && antipsychoticRows.length) flag(antipsychoticRows, "Antipsychotic + Parkinson's (" + pf.parkinsons.code + "): may worsen movement symptoms");
			if (utiTreatmentRows.length) flag(utiTreatmentRows, "Likely UTI treatment");
			if (utiSymptomRows.length) flag(utiSymptomRows, "UTI urinary symptom relief (phenazopyridine — not an antibiotic)");
			if (utiPossibleRows.length) flag(utiPossibleRows, "Possible UTI antibiotic — check indication");
			if (utiPreventionRows.length) flag(utiPreventionRows, "UTI prevention (methenamine)");
			var flagged = [];
			groups.forEach(function(g) {
				if (g.reasons.length) flagged.push(g);
			});
			return flagged;
		}
		function collectEntries(flagged) {
			var byReason = {}, out = [];
			flagged.forEach(function(g) {
				var n = shortName(g);
				g.reasons.forEach(function(reason) {
					var e = byReason[reason];
					if (!e) {
						e = byReason[reason] = {
							reason,
							names: [],
							sev: severityFor(reason)
						};
						out.push(e);
					}
					if (e.names.indexOf(n) === -1) e.names.push(n);
				});
			});
			var order = {
				HIGH: 0,
				MEDIUM: 1,
				LOW: 2
			};
			out.sort(function(a, b) {
				return order[a.sev] - order[b.sev];
			});
			return out;
		}
		function buildPanelHtml(entries) {
			if (!entries.length) return "<em>No flags.</em>";
			return entries.map(function(e) {
				var color = colorFor(e.sev).border;
				return "<div class=\"pcc-flag\" data-rkey=\"" + rationaleKeyFor(e.reason) + "\" data-meds=\"" + esc(e.names.join(", ")) + "\" style=\"margin:2px 0;cursor:pointer;padding:2px 4px;border-radius:4px;\" title=\"Click to copy a documentation sentence\"><b style=\"color:" + color + "\">[" + e.sev + "]</b> " + esc(e.reason) + " — " + esc(e.names.join(", ")) + " <span style=\"color:#666;font-size:11px;\">⧉</span></div>";
			}).join("");
		}
		function showRationalePopup(doc, rkey, meds, anchorEl) {
			closeRationalePopup(doc);
			var sentences = RATIONALE_SENTENCES[rkey] || RATIONALE_SENTENCES["general"];
			var pop = doc.createElement("div");
			pop.id = "pccRationalePop";
			pop.style.cssText = "position:fixed;z-index:999999;max-width:480px;background:#fff;border:2px solid #1d4ed8;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.3);padding:10px 12px;font-size:13px;";
			var title = doc.createElement("div");
			title.style.cssText = "font-weight:bold;margin-bottom:8px;color:#1d4ed8;";
			title.textContent = "Copy documentation sentence (" + meds + ") — click to copy:";
			pop.appendChild(title);
			sentences.forEach(function(s) {
				var filled = s.replace(/\[meds\]/gi, meds).replace(/\[Meds\]/g, meds);
				var btn = doc.createElement("button");
				btn.type = "button";
				btn.style.cssText = "display:block;width:100%;text-align:left;margin:0 0 6px 0;padding:6px 8px;font-size:12px;cursor:pointer;border:1px solid #93c5fd;background:#eff6ff;border-radius:4px;";
				btn.textContent = filled;
				btn.onmouseenter = function() {
					btn.style.background = "#dbeafe";
				};
				btn.onmouseleave = function() {
					btn.style.background = "#eff6ff";
				};
				btn.onclick = function(ev) {
					ev.stopPropagation();
					copyToClipboard(doc, filled, null);
					btn.textContent = "✓ Copied: " + filled;
					setTimeout(function() {
						closeRationalePopup(doc);
					}, 900);
				};
				pop.appendChild(btn);
			});
			var close = doc.createElement("button");
			close.type = "button";
			close.textContent = "Close";
			close.style.cssText = "margin-top:2px;padding:3px 12px;font-size:12px;cursor:pointer;";
			close.onclick = function(ev) {
				ev.stopPropagation();
				closeRationalePopup(doc);
			};
			pop.appendChild(close);
			pop.style.visibility = "hidden";
			doc.body.appendChild(pop);
			var r = null;
			try {
				r = anchorEl.getBoundingClientRect();
			} catch (e) {}
			var x = r ? r.left + window.scrollX : window.innerWidth / 2 - 240;
			var y = r ? r.bottom + window.scrollY + 6 : window.innerHeight / 2 - 100;
			x = Math.max(8, Math.min(x, window.innerWidth - 496));
			pop.style.left = x + "px";
			pop.style.top = y + "px";
			pop.style.visibility = "visible";
			setTimeout(function() {
				doc.addEventListener("click", closeRationalePopupOnOutside);
			}, 50);
			function closeRationalePopupOnOutside(ev) {
				if (!pop.contains(ev.target)) closeRationalePopup(doc);
			}
			pop.__outsideHandler = closeRationalePopupOnOutside;
		}
		function closeRationalePopup(doc) {
			var pop = doc.getElementById("pccRationalePop");
			if (pop) {
				if (pop.__outsideHandler) try {
					doc.removeEventListener("click", pop.__outsideHandler);
				} catch (e) {}
				pop.remove();
			}
		}
		function medTierOf(rowText) {
			var t = rowText || "";
			var isPsych = PSYCH.test(t);
			var isT2c = !isPsych && TIER2_COUNTED.test(t);
			var isT2u = !isPsych && !isT2c && TIER2_UNCOUNTED.test(t);
			var isPain = !isPsych && !isT2c && !isT2u && PAIN.test(t);
			if (isPsych) return 0;
			if (isT2c || isT2u) return 1;
			if (isPain) return 3;
			return 2;
		}
		function sortMedDisplay(groups, on) {
			return groups.slice().sort(function(a, b) {
				return (on ? a.tier : 2) - (on ? b.tier : 2) || a.po - b.po;
			});
		}
		function paintMedRows(doc, groups, sorted, on) {
			groups.forEach(function(g) {
				clearRowStyle(g);
				if (g.tier <= 1) applyColor(g, COLOR_PSYCH);
				else {
					var t = g.rows[0].innerText;
					if (UTI_TREATMENT.test(t)) applyColor(g, COLOR_UTI, "Likely UTI treatment");
					else if (UTI_SYMPTOM.test(t)) applyColor(g, COLOR_UTI, "Urinary symptom relief — not an antibiotic");
					else if (UTI_PREVENTION.test(t)) applyColor(g, COLOR_UTI, "UTI prevention");
					else if (UTI_POSSIBLE.test(t)) applyColor(g, COLOR_UTI, "Often UTI — check indication");
				}
			});
			if (on) {
				boxTier(sorted, function(g) {
					return g.tier <= 1;
				}, "#2563eb");
				boxTier(sorted, 3, "#ea580c");
			}
		}
		function sortMeds(doc) {
			var tbody = doc.querySelector("table.scrollTable > tbody");
			if (!tbody) return;
			var groups = getMedGroups(tbody);
			if (!groups.length) return;
			var on = isOn("pccPsychFirst");
			tbody.__po = tbody.__po || 0;
			var psychOnly = 0, tier2c = 0, tier2u = 0, painCount = 0;
			groups.forEach(function(g) {
				var r = g.rows[0];
				if (!r.hasAttribute("data-po")) r.setAttribute("data-po", tbody.__po++);
				g.po = +r.getAttribute("data-po");
				g.tier = medTierOf(r.innerText);
				if (g.tier === 0) psychOnly++;
				else if (g.tier === 1) {
					if (TIER2_COUNTED.test(r.innerText)) tier2c++;
					else tier2u++;
				} else if (g.tier === 3) painCount++;
				g.listed = !!matchMed(headerText(g));
			});
			var psychCount = psychOnly + tier2c;
			var sorted = sortMedDisplay(groups, on);
			if (sorted.some(function(g, i) {
				return g !== groups[i];
			})) sorted.forEach(function(g) {
				g.rows.forEach(function(r) {
					tbody.appendChild(r);
				});
			});
			var noExp = 0;
			if (on) groups.forEach(function(g) {
				var isPsychTier = g.tier <= 1;
				if (!isPsychTier && (g.tier > 1 && !g.listed || !isCollapsed(doc, g))) return;
				if (isPsychTier && !isCollapsed(doc, g)) return;
				var key = medKey(g.rows[0]);
				if (!isPsychTier && !shouldOpen(doc, key)) return;
				var x = findExpander(doc, g.rows[0]);
				if (x) {
					noteOpened(doc, key);
					x.click();
				} else noExp++;
			});
			paintMedRows(doc, groups, sorted, on);
			if (!tbody.__tmBorderWatch) {
				tbody.__tmBorderWatch = true;
				tbody.addEventListener("click", function(ev) {
					var t = ev.target && ev.target.closest ? ev.target.closest("a.row_toggle, .row_toggle") : null;
					if (!t || !tbody.contains(t)) return;
					setTimeout(function() {
						var gs = getMedGroups(tbody);
						gs.forEach(function(g) {
							var r = g.rows[0];
							g.tier = medTierOf(r.innerText);
							g.po = +(r.getAttribute("data-po") || 0);
						});
						paintMedRows(doc, gs, sortMedDisplay(gs, isOn("pccPsychFirst")), isOn("pccPsychFirst"));
					}, 150);
				});
			}
			var flagged = flagAll(groups);
			flagged.forEach(function(g) {
				applyColor(g, colorFor(g.reasons.reduce(function(acc, r) {
					var s = severityFor(r);
					var rank = {
						HIGH: 0,
						MEDIUM: 1,
						LOW: 2
					};
					return rank[s] < rank[acc] ? s : acc;
				}, "LOW")), g.reasons.map(function(x) {
					return severityFor(x) + ": " + x;
				}).join(" | "));
			});
			var entries = collectEntries(flagged);
			var highCount = entries.filter(function(e) {
				return e.sev === "HIGH";
			}).length;
			try {
				var cid = (location.search.match(/ESOLclientid=(\d+)/) || [])[1] || "";
				var highs = entries.filter(function(e) {
					return e.sev === "HIGH";
				}).map(function(e) {
					return e.reason;
				});
				localStorage.setItem("tmHighFlags", JSON.stringify({
					id: cid,
					highs,
					ts: Date.now()
				}));
				localStorage.setItem("tmRowPing", String(Date.now()));
			} catch (e) {}
			var psychToggleHtml = "<span style=\"font-weight:bold;\">Psych meds first: " + (on ? "ON" : "OFF") + "</span> <span style=\"font-size:15px;font-weight:bold;background:#2563eb;color:#fff;border-radius:10px;padding:2px 10px;margin-left:8px;white-space:nowrap;\">" + psychCount + " psych</span><div style=\"font-size:11px;color:#666;margin-top:2px;\">" + groups.length + " meds" + (tier2u ? " · +" + tier2u + " addiction uncounted" : "") + (painCount ? " · " + painCount + " pain at bottom" : "") + (noExp ? " · could not open " + noExp : "") + "</div>";
			setButton(doc, "interactionInfo", "⚠ " + entries.length + (entries.length === 1 ? " flag" : " flags") + " (" + highCount + " high) — click to hide/show · screening only", function() {
				togglePanel(doc, "interactionPanel");
			});
			setBox(doc, "interactionPanel", FLAG_BOX_CSS, buildPanelHtml(entries));
			try {
				var panel = doc.getElementById("interactionPanel");
				if (panel) {
					var flags = panel.querySelectorAll(".pcc-flag");
					for (var fi = 0; fi < flags.length; fi++) (function(f) {
						f.onclick = function(ev) {
							ev.stopPropagation();
							showRationalePopup(doc, f.getAttribute("data-rkey"), f.getAttribute("data-meds"), f);
						};
						f.onmouseenter = function() {
							f.style.background = "#ffedd5";
						};
						f.onmouseleave = function() {
							f.style.background = "";
						};
					})(flags[fi]);
				}
			} catch (e) {}
			var medRes = buildMedList(sorted);
			setBox(doc, "medListBox", MED_BOX_CSS, buildMedListHtml(medRes));
			setButton(doc, "psychToggle", psychToggleHtml, function() {
				setOn("pccPsychFirst", !isOn("pccPsychFirst"));
				sortMeds(doc);
			});
			var copyBtn = doc.getElementById("copyMedListBtn");
			var mbHide = doc.getElementById("medListBox");
			if (mbHide) mbHide.style.display = "none";
			var ptHide = doc.getElementById("psychToggle");
			if (ptHide) ptHide.style.display = "none";
			var seenMethadone = false;
			var medText = medRes.lines.map(function(l) {
				var body = l.replace(/^\s*-\s*/, "");
				if (/^methadone\b/i.test(body)) {
					if (seenMethadone) return null;
					seenMethadone = true;
					return "-Methadone managed by medical";
				}
				return l;
			}).filter(function(l) {
				return l !== null;
			}).join("\n");
			if (copyBtn) {
				copyBtn.setAttribute("data-fill-value", medText);
				copyBtn.onclick = function(e) {
					e.stopPropagation();
					copyToClipboard(doc, medText, copyBtn);
					try {
						localStorage.setItem("pccFillPsychMeds", JSON.stringify({
							value: medText,
							ts: Date.now()
						}));
					} catch (err) {}
				};
			}
			var medBoxStamp = doc.getElementById("medListBox");
			if (medBoxStamp) medBoxStamp.setAttribute("data-tm-meds-settled", "1");
			var labsData = buildLabsData(groups);
			var warnData = buildWarningsData(groups, doc);
			var labsRow = doc.getElementById("pccLabsRow");
			if (!labsRow) {
				labsRow = doc.createElement("div");
				labsRow.id = "pccLabsRow";
				labsRow.style.cssText = "display:flex;gap:8px;align-items:stretch;width:100%;box-sizing:border-box;margin:0 0 6px 0;";
				var topRow = doc.getElementById("pccTopRow");
				if (topRow && topRow.parentNode) topRow.parentNode.insertBefore(labsRow, topRow.nextSibling);
				else doc.body.insertBefore(labsRow, doc.body.firstChild);
			}
			var labsBox = doc.getElementById("labsBox");
			if (!labsBox) {
				labsBox = doc.createElement("div");
				labsBox.id = "labsBox";
				labsBox.style.cssText = "flex:0 0 calc(50% - 4px);width:calc(50% - 4px);box-sizing:border-box;padding:6px 10px;font-size:13px;border:1px solid #1d4ed8;background:#eff6ff;overflow-wrap:anywhere;";
				labsRow.appendChild(labsBox);
			}
			labsBox.innerHTML = buildLabsHtml(labsData);
			var labsCopyBtn = doc.getElementById("copyLabsBtn");
			if (labsCopyBtn) labsCopyBtn.onclick = function(e) {
				e.stopPropagation();
				copyToClipboard(doc, labsData.lines.join("\n"), labsCopyBtn);
			};
			var warnBox = doc.getElementById("warnBox");
			if (!warnBox) {
				warnBox = doc.createElement("div");
				warnBox.id = "warnBox";
				warnBox.style.cssText = "flex:0 0 calc(50% - 4px);width:calc(50% - 4px);box-sizing:border-box;padding:6px 10px;font-size:13px;border:1px solid #991b1b;background:#fef2f2;overflow-wrap:anywhere;";
				labsRow.appendChild(warnBox);
			}
			warnBox.innerHTML = buildWarningsHtml(warnData);
			applyMedsView(doc, groups);
			if (dashView() !== "main") {
				plantBoxes(doc);
				tidyMedsTop(doc);
			}
		}
		var LAB_BOX_CSS = "flex:0 0 calc(50% - 4px);width:calc(50% - 4px);box-sizing:border-box;padding:6px 10px;font-size:13px;border:1px solid #1d4ed8;background:#eff6ff;overflow-wrap:anywhere;";
		var WARN_BOX_CSS = "flex:0 0 calc(50% - 4px);width:calc(50% - 4px);box-sizing:border-box;padding:6px 10px;font-size:13px;border:1px solid #991b1b;background:#fef2f2;overflow-wrap:anywhere;";
		function watchCollapse(doc, box, label, namesOverride) {
			if (!box || box.querySelector(".tmWatchBody")) return;
			var body = doc.createElement("div");
			body.className = "tmWatchBody";
			while (box.firstChild) body.appendChild(box.firstChild);
			body.style.display = "none";
			var names = namesOverride ? namesOverride.slice() : [];
			if (!namesOverride) body.querySelectorAll("b, strong").forEach(function(b) {
				var w = (b.textContent || "").trim().split(/\s+/)[0].replace(/[^A-Za-z\-]/g, "");
				if (w && w.length > 2 && names.indexOf(w) === -1 && names.length < 6) names.push(w);
			});
			var bar = doc.createElement("div");
			bar.className = "tmWatchBar";
			bar.style.cssText = "font-weight:600;padding:2px 0;";
			var suffix = names.length ? " — " + names.join(" · ") : "";
			bar.textContent = "▸ " + label + suffix;
			box.onmouseenter = function() {
				body.style.display = "block";
				bar.textContent = "▾ " + label + suffix;
				refitFrame(doc);
			};
			box.onmouseleave = function() {
				body.style.display = "none";
				bar.textContent = "▸ " + label + suffix;
				refitFrame(doc);
			};
			box.appendChild(bar);
			box.appendChild(body);
		}
		function psychLabNames(groups) {
			if (!groups || !groups.length) return null;
			try {
				var seen = {}, out = [];
				buildLabsData(groups).items.forEach(function(o) {
					if (!o.psych || seen[o.name]) return;
					seen[o.name] = 1;
					out.push(o.name);
				});
				return out;
			} catch (e) {
				return null;
			}
		}
		function watchFlagsFlow(doc, box) {
			if (!box || box.querySelector(".tmWatchBody")) return;
			var body = doc.createElement("div");
			body.className = "tmWatchBody";
			while (box.firstChild) body.appendChild(box.firstChild);
			body.querySelectorAll(".pcc-flag").forEach(function(f) {
				f.style.display = "inline-block";
				f.style.margin = "2px 14px 2px 0";
				f.style.verticalAlign = "top";
			});
			body.style.cssText = "display:block;max-height:26px;overflow:hidden;";
			box.onmouseenter = function() {
				body.style.maxHeight = "none";
				refitFrame(doc);
			};
			box.onmouseleave = function() {
				body.style.maxHeight = "26px";
				refitFrame(doc);
			};
			box.appendChild(body);
		}
		function applyMedsView(doc, groups) {
			var mica = dashView() === "main";
			var flags = doc.getElementById("interactionPanel");
			var labs = doc.getElementById("labsBox");
			var warn = doc.getElementById("warnBox");
			var topRow = doc.getElementById("pccTopRow");
			var labsRow = doc.getElementById("pccLabsRow");
			var watch = doc.getElementById("tmWatchBox");
			if (mica) {
				if (!watch && topRow && topRow.parentNode) {
					watch = doc.createElement("div");
					watch.id = "tmWatchBox";
					watch.style.cssText = "display:block;width:100%;box-sizing:border-box;margin:0 0 6px 0;";
					topRow.parentNode.insertBefore(watch, topRow);
				}
				if (watch) {
					[
						flags,
						labs,
						warn
					].forEach(function(b) {
						if (!b) return;
						watch.appendChild(b);
						b.style.flex = "none";
						b.style.width = "100%";
						b.style.marginLeft = "0";
						b.style.marginBottom = "8px";
						b.style.display = "block";
					});
					watchCollapse(doc, labs, "Labs to monitor", psychLabNames(groups));
					watchCollapse(doc, warn, "Black box");
					watchFlagsFlow(doc, flags);
				}
				if (topRow) topRow.style.display = "none";
				if (labsRow) labsRow.style.display = "none";
			} else if (watch) {
				watch.remove();
				if (topRow) {
					topRow.style.display = "";
					if (flags) {
						topRow.appendChild(flags);
						flags.style.cssText = FLAG_BOX_CSS;
					}
				}
				if (labsRow) {
					labsRow.style.display = "";
					if (labs) {
						labsRow.appendChild(labs);
						labs.style.cssText = LAB_BOX_CSS;
					}
					if (warn) {
						labsRow.appendChild(warn);
						warn.style.cssText = WARN_BOX_CSS;
					}
				}
			}
			renderMedsPanel(doc, groups, mica);
			var mTable = null;
			if (groups && groups.length && groups[0].rows[0]) mTable = groups[0].rows[0].closest("table");
			trimTable(doc, mTable, ["Order"], !mica);
			sealBoxes(mTable);
		}
		function ensurePadStyle(doc) {
			if (doc.getElementById("tmPadStyle")) return;
			var st = doc.createElement("style");
			st.id = "tmPadStyle";
			st.textContent = ".tmPadTable td, .tmPadTable th { padding-left: 10px !important; }";
			doc.head.appendChild(st);
		}
		function sealBoxes(table) {
			if (!table) return;
			table.querySelectorAll("tr").forEach(function(r) {
				var cells = r.cells || [];
				var color = "";
				for (var i = 0; i < cells.length; i++) {
					var c = cells[i].style.borderLeftColor || cells[i].style.borderTopColor || "";
					if (c) {
						color = c;
						break;
					}
				}
				if (!color) return;
				var vis = [];
				for (var j = 0; j < cells.length; j++) if (!cells[j].hasAttribute("data-tm-colhide")) vis.push(cells[j]);
				if (!vis.length) return;
				var hasTop = false, hasBottom = false;
				for (var k = 0; k < cells.length; k++) {
					if (cells[k].style.borderTop) hasTop = true;
					if (cells[k].style.borderBottom) hasBottom = true;
				}
				vis[0].style.borderLeft = "3px solid " + color;
				vis[vis.length - 1].style.borderRight = "3px solid " + color;
				if (hasTop) vis.forEach(function(c) {
					c.style.borderTop = "3px solid " + color;
				});
				if (hasBottom) vis.forEach(function(c) {
					c.style.borderBottom = "3px solid " + color;
				});
			});
		}
		function trimTable(doc, table, keep, folded) {
			if (!table) return;
			if (!folded) {
				table.querySelectorAll("[data-tm-colhide=\"1\"]").forEach(function(c) {
					c.style.display = "";
					c.removeAttribute("data-tm-colhide");
				});
				table.classList.remove("tmPadTable");
				return;
			}
			table.classList.add("tmPadTable");
			ensurePadStyle(doc);
			var rows = table.querySelectorAll("tr");
			var hdr = null, hideIdx = [];
			rows.forEach(function(r) {
				if (hdr) return;
				var cells = r.cells || [];
				var texts = [];
				for (var i = 0; i < cells.length; i++) texts.push((cells[i].textContent || "").replace(/\s+/g, " ").trim());
				if (texts.indexOf(keep[0]) !== -1 && texts.length >= 3) {
					hdr = r;
					texts.forEach(function(tx, i) {
						if (keep.indexOf(tx) === -1) hideIdx.push(i);
					});
				}
			});
			if (!hdr || !hideIdx.length) return;
			rows.forEach(function(r) {
				var cells = r.cells || [];
				for (var i = 0; i < cells.length; i++) if (cells[i].colSpan > 1) return;
				hideIdx.forEach(function(i) {
					if (cells[i]) {
						cells[i].style.display = "none";
						cells[i].setAttribute("data-tm-colhide", "1");
					}
				});
			});
		}
		function escHtml(s) {
			return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		}
		function giveText(g) {
			if (!g.rows[1]) return "";
			return (g.rows[1].innerText || "").trim().split(/\n/)[0].replace(/^Give\s+/i, "");
		}
		function strengthOf(g) {
			var m = ((g.rows[0].innerText || "").trim().split(/\n|\t/)[0] || "").match(/(\d[\d.,\/]*\s*(?:MG\/ML|UNIT\/GM|MG|MCG|ML|%|UNITS?|GM|G))(?=[\s(]|$)/i);
			return m ? m[1].toUpperCase() : "";
		}
		function freqWord(give) {
			var s = (give || "").toLowerCase();
			var base = "";
			if (/two times a day/.test(s)) base = "BID";
			else if (/three times a day/.test(s)) base = "TID";
			else if (/four times a day/.test(s)) base = "QID";
			else if (/at bed\s?time/.test(s)) base = "QHS";
			else if (/every other day/.test(s)) base = "QOD";
			else {
				var h = s.match(/every (\d+) hours?/);
				if (h) base = "q" + h[1] + "h";
			}
			if (!base && /one time a day|once daily|one time each day/.test(s)) base = "daily";
			if (!base && /in the morning/.test(s)) base = "QAM";
			if (!base && /once a week|one time a week/.test(s)) base = "weekly";
			if (/as needed/.test(s)) return base ? base + " PRN" : "PRN";
			return base;
		}
		function oneLiner(g) {
			var fw = freqWord(giveText(g));
			return escHtml(shortName(g) + " " + strengthOf(g) + (fw ? " " + fw : ""));
		}
		function orderLine(g) {
			var give = giveText(g);
			return "<b>" + escHtml(shortName(g) + " " + strengthOf(g)) + "</b>" + (give ? " — " + escHtml(give) : "");
		}
		function renderMedsPanel(doc, groups, folded) {
			doc.querySelectorAll("[data-tm-compact=\"1\"]").forEach(function(r) {
				r.style.display = "";
				r.removeAttribute("data-tm-compact");
			});
			var table = null;
			if (groups && groups.length && groups[0].rows[0]) table = groups[0].rows[0].closest("table");
			var panel = doc.getElementById("tmMedsPanel");
			if (!folded) {
				if (panel) panel.remove();
				if (table) table.style.display = "";
				return;
			}
			if (!table || !table.parentNode) return;
			if (!panel) {
				panel = doc.createElement("div");
				panel.id = "tmMedsPanel";
				table.parentNode.insertBefore(panel, table);
			}
			panel.style.cssText = "background:#fff;border:1px solid #d6d0bd;border-radius:6px;margin:0 0 6px 0;font-family:-apple-system,Helvetica,Arial,sans-serif;";
			try {
				flagAll(groups || []);
				(groups || []).forEach(function(g) {
					g.__warnBg = "";
					if (g.reasons && g.reasons.length) g.__warnBg = colorFor(g.reasons.reduce(function(acc, r) {
						var s = severityFor(r);
						var rank = {
							HIGH: 0,
							MEDIUM: 1,
							LOW: 2
						};
						return rank[s] < rank[acc] ? s : acc;
					}, "LOW")).bg;
				});
			} catch (e) {}
			function hl(g, lineHtml) {
				var bg = g.__warnBg;
				return bg ? "<span style=\"background:" + bg + ";border-radius:3px;padding:0 3px;\">" + lineHtml + "</span>" : lineHtml;
			}
			var psych = [], pain = [], others = [];
			(groups || []).forEach(function(g) {
				if (g.tier <= 1) psych.push(hl(g, orderLine(g)));
				else if (g.tier === 3) pain.push(hl(g, oneLiner(g)));
				else others.push(hl(g, oneLiner(g)));
			});
			var html = "<div style=\"padding:8px 10px;font-size:13px;line-height:1.6;\">";
			html += "<div style=\"border:2px solid #2563eb;border-radius:4px;padding:6px 9px;margin-bottom:8px;\">" + (psych.length ? psych.join("<br>") : "- no psych meds") + "</div>";
			if (others.length) html += "<div style=\"color:#44403c;\">" + others.join(" · ") + "</div>";
			html += "<div style=\"color:#7c2d12;border:2px solid #ea580c;border-radius:4px;padding:5px 9px;margin-top:8px;\">" + (pain.length ? "Pain: " + pain.join(" · ") : "- no pain medications") + "</div>";
			html += "<div id=\"tmMedsFullBar\" style=\"margin-top:7px;color:#334155;cursor:pointer;font-weight:600;\">▸ show full order text (" + (groups ? groups.length : 0) + " orders)</div>";
			html += "</div>";
			panel.innerHTML = html;
			table.style.display = "none";
			var bar = panel.querySelector("#tmMedsFullBar");
			if (bar) bar.onclick = function() {
				var show = table.style.display === "none";
				table.style.display = show ? "" : "none";
				bar.textContent = show ? "▾ hide full order text" : "▸ show full order text (" + (groups ? groups.length : 0) + " orders)";
				refitFrame(doc);
			};
		}
		function codesIn(r) {
			return r.innerText.match(CODE_RE) || [];
		}
		function dxTier(r) {
			var best = 3;
			codesIn(r).forEach(function(code) {
				var c = code.replace(".", "");
				var t = c.charAt(0) === "F" ? 0 : RELATED_G.test(c) ? 1 : RELATED_R.test(c) ? 2 : 3;
				if (t < best) best = t;
			});
			return best;
		}
		function scanPatientConditions(groups) {
			var flags = {};
			function set(name, code) {
				flags[name] = {
					found: true,
					code
				};
			}
			groups.forEach(function(g) {
				codesIn(g.rows[0]).forEach(function(code) {
					var c = code.replace(".", "");
					if (CKD_RE.test(c)) set("ckd", code);
					if (LIVER_RE.test(c)) set("liver", code);
					if (SEIZURE_DX_RE.test(c)) set("seizure", code);
					if (DIABETES_RE.test(c)) set("diabetes", code);
					if (GLAUCOMA_DX_RE.test(c)) set("glaucoma", code);
					if (SLEEP_APNEA_RE.test(c)) set("sleepApnea", code);
					if (PARKINSONS_RE.test(c)) set("parkinsons", code);
				});
			});
			patientFlags = flags;
		}
		function sortDx(doc) {
			var trs = doc.querySelectorAll("tr"), first = null;
			for (var i = 0; i < trs.length; i++) if (!trs[i].querySelector("tr") && codesIn(trs[i]).length) {
				first = trs[i];
				break;
			}
			if (!first) return;
			var tbody = first.parentElement;
			var groups = [], cur = null;
			Array.prototype.forEach.call(tbody.children, function(r) {
				if (r.tagName !== "TR") return;
				if (codesIn(r).length) {
					cur = { rows: [r] };
					groups.push(cur);
				} else if (cur) cur.rows.push(r);
			});
			if (!groups.length) return;
			scanPatientConditions(groups);
			tbody.__dpo = tbody.__dpo || 0;
			var fCount = 0, gCount = 0, rCount = 0;
			groups.forEach(function(g) {
				var r = g.rows[0];
				if (!r.hasAttribute("data-dpo")) r.setAttribute("data-dpo", tbody.__dpo++);
				g.po = +r.getAttribute("data-dpo");
				g.tier = dxTier(r);
				if (g.tier === 0) fCount++;
				else if (g.tier === 1) gCount++;
				else if (g.tier === 2) rCount++;
			});
			groups.forEach(function(g) {
				clearRowStyle(g);
				if (g.tier <= 1) applyColor(g, COLOR_PSYCH);
			});
			var on = isOn("pccDxFirst");
			var sorted = groups.slice().sort(function(a, b) {
				return (on ? a.tier : 3) - (on ? b.tier : 3) || a.po - b.po;
			});
			if (sorted.some(function(g, i) {
				return g !== groups[i];
			})) sorted.forEach(function(g) {
				g.rows.forEach(function(r) {
					tbody.appendChild(r);
				});
			});
			doc.querySelectorAll("a").forEach(function(a) {
				if ((a.textContent || "").replace(/\s+/g, " ").trim() === "Add Diagnosis") a.style.display = "none";
			});
			if (on) boxTier(sorted, function(g) {
				return g.tier <= 1;
			}, "#2563eb");
			setButton(doc, "dxToggle", "Psych dx first: " + (on ? "ON" : "OFF") + " (F: " + fCount + ", G: " + gCount + ", R: " + rCount + ", of " + groups.length + " dx)", function() {
				setOn("pccDxFirst", !isOn("pccDxFirst"));
				sortDx(doc);
			});
			applyDxView(doc, sorted, tbody);
		}
		function applyDxView(doc, groups, tbody) {
			doc.querySelectorAll("[data-tm-dxhide=\"1\"]").forEach(function(r) {
				r.style.display = "";
				r.removeAttribute("data-tm-dxhide");
			});
			var oldBar = doc.getElementById("tmDxBar");
			if (oldBar && oldBar.tagName === "TR") oldBar.remove();
			var folded = dashView() === "main";
			var table = null;
			var firstRow = null;
			(groups || []).some(function(g) {
				if (g.rows[0]) {
					firstRow = g.rows[0];
					return true;
				}
				return false;
			});
			if (firstRow) table = firstRow.closest("table");
			var panel = doc.getElementById("tmDxPanel");
			trimTable(doc, table, ["ICD-10", "Short Description"], !folded);
			sealBoxes(table);
			if (!folded) {
				if (panel) panel.remove();
				if (table) table.style.display = "";
				return;
			}
			if (!table || !table.parentNode) return;
			if (!panel) {
				panel = doc.createElement("div");
				panel.id = "tmDxPanel";
				table.parentNode.insertBefore(panel, table);
			}
			panel.style.cssText = "background:#fff;border:1px solid #d6d0bd;border-radius:6px;margin:0 0 6px 0;font-family:-apple-system,Helvetica,Arial,sans-serif;";
			function dxLine(g) {
				var parts = g.rows.map(function(r) {
					return r.innerText || "";
				}).join("\n").split(/\t|\n/).map(function(s) {
					return s.trim();
				}).filter(function(s) {
					return s;
				});
				var ci = -1, code = "";
				for (var i = 0; i < parts.length; i++) if (/^[A-Z]\d{2}(\.\d{1,2})?$/.test(parts[i])) {
					ci = i;
					code = parts[i];
					break;
				}
				if (ci === -1) return parts.join(" ");
				var desc = parts.slice(ci + 1).filter(function(p) {
					return p !== code;
				}).join(" ");
				return (code + " " + desc).trim();
			}
			var psych = [], rest = [];
			(groups || []).forEach(function(g) {
				if (g.tier <= 1) psych.push(dxLine(g));
				else rest.push(dxLine(g));
			});
			var html = "<div style=\"padding:8px 10px;font-size:13px;line-height:1.6;\">";
			if (psych.length) html += "<div style=\"border:2px solid #2563eb;border-radius:4px;padding:6px 9px;\">" + psych.map(escHtml).join("<br>") + "</div>";
			if (rest.length) {
				html += "<div id=\"tmDxMore\" style=\"display:none;margin-top:7px;\">" + rest.map(escHtml).join("<br>") + "</div>";
				html += "<div id=\"tmDxBar\" style=\"margin-top:7px;color:#334155;cursor:pointer;font-weight:600;\">▸ " + rest.length + " more diagnoses — click to show all</div>";
			}
			html += "</div>";
			panel.innerHTML = html;
			table.style.display = "none";
			var bar = panel.querySelector("#tmDxBar");
			var more = panel.querySelector("#tmDxMore");
			if (bar && more) bar.onclick = function() {
				var show = more.style.display === "none";
				more.style.display = show ? "block" : "none";
				bar.textContent = show ? "▾ " + rest.length + " more diagnoses — click to hide" : "▸ " + rest.length + " more diagnoses — click to show all";
				refitFrame(doc);
			};
		}
		function expand(doc) {
			var win = doc.defaultView;
			var clips = [];
			doc.querySelectorAll("body *").forEach(function(e) {
				if (e.scrollHeight > e.clientHeight + 1) {
					var cs = win.getComputedStyle(e);
					if (/(auto|scroll|hidden)/.test(cs.overflowY)) clips.push(e);
				}
			});
			clips.forEach(function(e) {
				e.style.setProperty("height", "auto", "important");
				e.style.setProperty("max-height", "none", "important");
				e.style.setProperty("overflow", "visible", "important");
			});
			[doc.documentElement, doc.body].forEach(function(e) {
				e.style.setProperty("overflow", "visible", "important");
			});
		}
		function contentBottom(doc) {
			var bottom = 0;
			doc.querySelectorAll("tr, #tmMedsPanel, #tmDxPanel, #tmWatchBox, #pccTopRow, #pccLabsRow").forEach(function(r) {
				var b = r.getBoundingClientRect().bottom;
				if (b > bottom) bottom = b;
			});
			return bottom || doc.body.scrollHeight;
		}
		function unclipParents(f) {
			var el = f.parentElement;
			while (el && el !== document.body && el !== document.documentElement) {
				if (el.clientHeight < f.offsetHeight - 2) {
					el.style.setProperty("height", "auto", "important");
					el.style.setProperty("max-height", "none", "important");
					el.style.setProperty("overflow", "visible", "important");
				}
				el = el.parentElement;
			}
		}
		function refitFrame(doc) {
			document.querySelectorAll("iframe[id^=\"iFramePanel_\"]").forEach(function(f) {
				try {
					if ((f.contentDocument || f.contentWindow.document) !== doc) return;
					expand(doc);
					var h = Math.ceil(contentBottom(doc)) + 30;
					if (h > 80 && Math.abs(h - f.offsetHeight) > 5) f.style.height = h + "px";
					unclipParents(f);
				} catch (e) {}
			});
		}
		function applySideBySide() {
			var st = document.getElementById("tmSideStyle");
			if (dashView() !== "main") {
				if (!st) {
					st = document.createElement("style");
					st.id = "tmSideStyle";
					st.textContent = "#dragArea{display:flex !important;gap:10px;align-items:flex-start;}#dragArea > tbody{display:contents;}#dragArea > tbody > tr{flex:1 1 0;min-width:0;height:auto !important;}#dragArea > tbody > tr > td{display:block;width:auto !important;}";
					document.head.appendChild(st);
				}
			} else if (st) st.remove();
		}
		var processedSig = {};
		function frameSig(doc) {
			var best = null, bestRows = 0;
			doc.querySelectorAll("table").forEach(function(tb) {
				var n = tb.rows ? tb.rows.length : 0;
				if (n > bestRows) {
					bestRows = n;
					best = tb;
				}
			});
			if (!best || bestRows < 2) return "";
			var sum = 0;
			for (var i = 0; i < best.rows.length; i++) sum += (best.rows[i].textContent || "").length;
			return bestRows + ":" + sum;
		}
		function fit() {
			plantViewToggle();
			applySideBySide();
			document.querySelectorAll("iframe[id^=\"iFramePanel_\"]").forEach(function(f) {
				try {
					var doc = f.contentDocument || f.contentWindow.document;
					if (!doc || !doc.body) return;
					var isMeds = f.id === "iFramePanel_Medications";
					if (!isMeds && !DX_FRAME.test(f.id)) return;
					var sig = frameSig(doc);
					if (sig && processedSig[f.id] === sig) return;
					if (isMeds && dashView() === "main") {
						pullBoxes(doc);
						untidyMedsTop(doc);
					}
					if (isMeds) sortMeds(doc);
					else sortDx(doc);
					expand(doc);
					var h = Math.ceil(contentBottom(doc)) + 30;
					if (h > 80 && Math.abs(h - f.offsetHeight) > 5) f.style.height = h + "px";
					unclipParents(f);
					if (sig) processedSig[f.id] = sig;
				} catch (e) {}
			});
		}
		try {
			window.__tmDashCurateMeds = function(doc) {
				try {
					var all = doc.querySelectorAll("*");
					for (var ai = 0; ai < all.length; ai++) try {
						Object.defineProperty(all[ai], "innerText", {
							value: all[ai].textContent,
							configurable: true
						});
					} catch (e2) {}
					var tbody = doc.querySelector("table.scrollTable > tbody");
					if (!tbody) return null;
					var groups = getMedGroups(tbody);
					if (!groups.length) return null;
					groups.forEach(function(g, i) {
						g.tier = medTierOf(g.rows[0].innerText);
						g.po = i;
					});
					var res = buildMedList(sortMedDisplay(groups, isOn("pccPsychFirst")));
					if (!res || !res.lines || !res.lines.length) return null;
					return res.lines.join("\n");
				} catch (e) {
					return null;
				}
			};
		} catch (e) {}
		document.querySelectorAll("iframe[id^=\"iFramePanel_\"]").forEach(function(f) {
			f.addEventListener("load", function() {
				setTimeout(fit, 100);
			});
		});
		window.__tmCore.ladder(fit, [
			600,
			1600,
			3200
		]);
	})();
	(function() {
		"use strict";
		var SIGNALS = [
			{
				label: "Refusals",
				words: [
					"refused",
					"refuses",
					"refusing",
					"refusal"
				]
			},
			{
				label: "Agitation",
				words: [
					"agitated",
					"agitation",
					"agitating",
					"restless",
					"restlessness"
				]
			},
			{
				label: "Sundowning",
				words: ["sundowning", "sundowner"]
			},
			{
				label: "Poor sleep",
				phrases: [
					"poor sleep",
					"did not sleep",
					"didn't sleep",
					"slept poorly",
					"unable to sleep",
					"up all night",
					"awake all night",
					"sleepless"
				],
				words: ["insomnia"]
			},
			{
				label: "Falls",
				words: [
					"fell",
					"fall",
					"falls"
				],
				phrases: [
					"found on the floor",
					"found on floor",
					"slid out of bed",
					"slid out of the chair",
					"slipped out of bed"
				]
			},
			{
				label: "Yelling / calling out",
				words: [
					"yelling",
					"screaming",
					"shouting"
				],
				phrases: [
					"calling out",
					"vocalizing",
					"vocalization"
				]
			},
			{
				label: "Wandering",
				words: ["wandering", "wandered"],
				phrases: [
					"exit seeking",
					"exit-seeking",
					"trying to leave",
					"attempted to leave",
					"attempting to leave"
				]
			},
			{
				label: "Aggression",
				words: [
					"hitting",
					"struck",
					"kicked",
					"kicking",
					"biting",
					"scratching",
					"combative",
					"aggressive",
					"assaultive"
				],
				phrases: [
					"spit at",
					"spitting at",
					"threw at",
					"throwing objects"
				]
			},
			{
				label: "Tearfulness",
				words: [
					"tearful",
					"tearfulness",
					"crying",
					"weeping"
				],
				phrases: ["crying spells", "crying episodes"]
			},
			{
				label: "Anxiety",
				words: [
					"anxious",
					"anxiety",
					"panicky",
					"worried"
				],
				phrases: ["panic attack"]
			},
			{
				label: "Poor appetite",
				phrases: [
					"poor appetite",
					"appetite poor",
					"decreased appetite",
					"appetite decreased",
					"no appetite",
					"not eating",
					"refusing meals",
					"refused meals",
					"refusing food",
					"refused food",
					"poor intake"
				]
			},
			{
				label: "Withdrawn",
				words: ["withdrawn"],
				phrases: [
					"isolating",
					"isolates",
					"stays in room",
					"stayed in room",
					"remains in room",
					"in room all day",
					"refuses activities",
					"refused activities",
					"not participating"
				]
			},
			{
				label: "Non-compliance",
				phrases: [
					"non-compliant",
					"noncompliant",
					"non-compliance",
					"noncompliance",
					"not compliant",
					"poorly compliant"
				]
			}
		];
		var NEG = /\b(no|not|denies|denied|deny|without|none|never|absent|free of)\b/i;
		var FALL_GUARDS = [
			/falls?\s+risk/i,
			/risk\s+of\s+falls?/i,
			/risk\s+for\s+falls?/i,
			/fall\s+precaution/i,
			/fall\s+prevention/i
		];
		var FALL_HIST = /\b(?:s\/p|status\s+post|h\/o|hx|history\s+of)\s+falls?\b/i;
		var FALL_ADMIT = /\bpresent(?:ed|s|ing)?\s+(?:after|with)\s+a?\s*falls?\b/i;
		var WITH_DX_OF = /\bwith\s+(?:a\s+)?dx\s+of\b/i;
		var SPEC = /\b(?:improved\s+from|resolved|no\s+longer)\b/i;
		var MONITOR_FOR = /\b(?:monitor|watch|assess)\s+for\b/i;
		var DIFF = /\br\/t\b|\bdifferential\b|\brule\s*out\b|\bmay also be\b/i;
		var CC = /\bchief complaint\b|\breason for (visit|encounter|referral)\b/i;
		var MED_CTX = /medication|\bmeds?\b|dose|pill|drug|\btx\b/i;
		function inLabelZone(full, absIdx) {
			var pre = full.slice(Math.max(0, absIdx - 70), absIdx);
			var li = pre.search(/behavior\(s\)\s+observed\s*:/i);
			if (li === -1) return false;
			return !/[.!?]\s+[A-Z]/.test(pre.slice(li));
		}
		function uncheckedBox(full, absIdx) {
			var cb = full.slice(0, absIdx);
			var lastBox = Math.max(cb.lastIndexOf("[ ]"), cb.lastIndexOf("[]"), cb.lastIndexOf("[x]"), cb.lastIndexOf("[ x]"), cb.lastIndexOf("[X]"));
			if (lastBox === -1) return false;
			return /^\[\s*\]$/.test(cb.slice(lastBox, lastBox + 3).trim());
		}
		function escRe(s) {
			return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
		function sentenceAround(text, idx) {
			var start = Math.max(text.lastIndexOf(".", idx - 1), text.lastIndexOf("\n", idx - 1), text.lastIndexOf("!", idx - 1), text.lastIndexOf("?", idx - 1)) + 1;
			if (idx - start > 90) {
				start = idx - 90;
				var sp = text.indexOf(" ", start);
				if (sp !== -1 && sp < idx) start = sp + 1;
			}
			var ends = [
				text.indexOf(".", idx),
				text.indexOf("\n", idx),
				text.indexOf("!", idx),
				text.indexOf("?", idx)
			].filter(function(x) {
				return x !== -1;
			});
			var end = ends.length ? Math.min.apply(null, ends) + 1 : text.length;
			var s = text.slice(start, end).replace(/\s+/g, " ").trim();
			s = s.replace(/\*+\s*document\s+e-signed\s+by\s+[^*]+/gi, "").replace(/\*+/g, "").trim();
			return s;
		}
		var ORDER_RE = /\b(give|apply|instill|inhale|inject)\b[^.!?]*\b(by mouth|topically|orally)\b/i;
		var ACTIVE_RE = /\bACTIVE\s*,/;
		var GOAL_RE = /by (review|target) date/i;
		var COMP_TX = /\b(complicated by|sedation|hypotension)\b/i;
		var COMP_DRUGS = /\b(lorazepam|haloperidol|olanzapine|quetiapine|risperidone|ativan|seroquel|zyprexa|versed|midazolam)\b/i;
		function matchOk(text, m, label) {
			var start = m.index, end = start + m[0].length;
			var isFall = label === "Falls";
			if (isFall) {
				var around = text.slice(Math.max(0, start - 14), end + 14);
				var g, bad = false;
				for (g = 0; g < FALL_GUARDS.length; g++) if (FALL_GUARDS[g].test(around)) {
					bad = true;
					break;
				}
				if (bad) return false;
				if (/\b(?:s\/p|status\s+post|h\/o|hx|history\s+of)\s+falls?\b/i.test(around)) return false;
				if (WITH_DX_OF.test(around)) return false;
				if (FALL_HIST.test(around)) return false;
				if (FALL_ADMIT.test(around)) return false;
			}
			var cut = Math.max(text.lastIndexOf(".", start - 1), text.lastIndexOf("!", start - 1), text.lastIndexOf("?", start - 1), text.lastIndexOf("\n", start - 1), text.lastIndexOf(";", start - 1));
			var before = text.slice(cut + 1, start);
			if (before.length > 48) before = before.slice(before.length - 48);
			if (NEG.test(before)) return false;
			var sent = sentenceAround(text, start);
			if (ORDER_RE.test(sent) || ACTIVE_RE.test(sent) || GOAL_RE.test(sent)) return false;
			if (/\?/.test(sent)) return false;
			if (/\b(30[\s-]?day|event summary)\b/i.test(sent)) return false;
			if (SPEC.test(sent)) return false;
			if (MONITOR_FOR.test(sent)) return false;
			if (COMP_TX.test(sent) && COMP_DRUGS.test(sent)) return false;
			if (DIFF.test(sent)) return false;
			if (CC.test(sent)) return false;
			if (/\([A-Z]\d{2}[\d.]*\)?/.test(sent)) return false;
			var ccBefore = text.slice(Math.max(0, start - 120), start);
			if (/\bchief complaint\s*:/i.test(ccBefore)) {
				var ccPos = ccBefore.search(/\bchief complaint\s*:/i);
				if (!/[.!?]\s+[A-Z]/.test(ccBefore.slice(ccPos))) return false;
			}
			if (uncheckedBox(text, start)) return false;
			var cleanSent = sent.replace(/\*+/g, "").trim();
			if (/^\d{1,3}\s*:\s*[A-Za-z][\w ,.'()-]*$/.test(cleanSent)) return false;
			if (/^\d{1,3}\s+[^a-z\n]{4,}\s+[A-Z]\d{2}(?:\.\w+)?\.?\s*$/.test(cleanSent)) return false;
			if (inLabelZone(text, start)) return false;
			if (WITH_DX_OF.test(sent)) return false;
			if (/\bwith\s+a\s+history\s+of\b[^.\n]*,/i.test(sent)) return false;
			if (isFall && (/\bprimary\s+dx\s*:/i.test(sent) || /\bdx\s*:/i.test(sent) || /^[A-Z]\d{2}(?:\.\w+)?:/i.test(cleanSent))) return false;
			if (isFall && !/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(sent)) return false;
			return true;
		}
		function proseSignals(prose) {
			var found = {};
			if (!prose) return found;
			for (var i = 0; i < SIGNALS.length; i++) {
				var sig = SIGNALS[i];
				var pats = [];
				(sig.words || []).forEach(function(w) {
					pats.push(new RegExp("\\b" + escRe(w) + "\\b", "gi"));
				});
				(sig.phrases || []).forEach(function(p) {
					pats.push(new RegExp(escRe(p).replace(/\s+/g, "\\s+"), "gi"));
				});
				var count = 0;
				for (var pi = 0; pi < pats.length; pi++) {
					var re = pats[pi];
					re.lastIndex = 0;
					var m;
					while ((m = re.exec(prose)) !== null) {
						if (matchOk(prose, m, sig.label)) count++;
						if (m[0].length === 0) re.lastIndex++;
					}
				}
				if (count > 0) found[sig.label] = count;
			}
			return found;
		}
		function medRefusal(prose) {
			var s = (prose || "").toLowerCase();
			return /\brefus(?:ed|es|ing|al)\b/.test(s) && MED_CTX.test(s);
		}
		function norm(s) {
			return (s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
		}
		function proseOf(row) {
			var cells = Array.prototype.slice.call(row.querySelectorAll("td"));
			var dateCell = -1;
			for (var c = 0; c < cells.length - 1; c++) if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(cells[c].textContent || "")) {
				dateCell = c;
				break;
			}
			var clone = (dateCell !== -1 && cells[dateCell + 2] ? cells[dateCell + 2] : row).cloneNode(true);
			var bs = clone.querySelectorAll("b, strong");
			for (var i = 0; i < bs.length; i++) if (/:\s*$/.test(norm(bs[i].textContent))) bs[i].remove();
			var ui = clone.querySelectorAll(".pnBehTopBtn, .pnBehFbBar, #pnTilesWrap");
			for (var q = 0; q < ui.length; q++) ui[q].remove();
			return norm(clone.textContent);
		}
		function extract(doc) {
			var out = [];
			if (!doc || !doc.querySelectorAll) return out;
			var links = Array.prototype.slice.call(doc.querySelectorAll("a")).filter(function(a) {
				return norm(a.textContent).toLowerCase() === "view";
			});
			if (!links.length) return out;
			var table = links[0].closest ? links[0].closest("table") : null;
			if (!table) return out;
			var rows = table.querySelectorAll("tr");
			for (var r = 0; r < rows.length; r++) {
				var row = rows[r];
				if (!row.querySelector("a")) continue;
				if (!Array.prototype.slice.call(row.querySelectorAll("a")).some(function(a) {
					return norm(a.textContent).toLowerCase() === "view";
				})) continue;
				var text = norm(row.textContent);
				var m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
				if (!m) continue;
				var prose = proseOf(row);
				if (!prose || prose.length < 10) continue;
				var counts = proseSignals(prose);
				var sigs = Object.keys(counts);
				var y = +m[3], mo = +m[1], dd = +m[2];
				out.push({
					date: y + "-" + (mo < 10 ? "0" : "") + mo + "-" + (dd < 10 ? "0" : "") + dd,
					signals: sigs,
					counts,
					medRefusal: medRefusal(prose),
					text: prose.slice(0, 2e3)
				});
			}
			return out;
		}
		window.__tmBehEvents = {
			extract,
			proseSignals,
			sentenceAround
		};
	})();
	(function() {
		"use strict";
		var stopped = false;
		var NODE_ID = "tmGatherPacket";
		function nowT() {
			var d = new Date();
			return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2);
		}
		function norm(s) {
			return (s || "").replace(/\s+/g, " ").trim();
		}
		function txt(el) {
			return norm(el && (el.innerText !== void 0 ? el.innerText : el.textContent));
		}
		var STOP_KEYS = [
			"header",
			"behaviors",
			"diagnoses",
			"bims",
			"relations",
			"facesheet",
			"admission",
			"labs",
			"ownnotes",
			"orders",
			"weights",
			"dashmeds",
			"hisnotes"
		];
		function emptyPacket() {
			var stops = {};
			STOP_KEYS.forEach(function(k) {
				stops[k] = {
					status: "not-loaded",
					source: "",
					at: "",
					strength: ""
				};
			});
			return {
				v: 4,
				startedAt: nowT(),
				stops
			};
		}
		var STR_RANK = {
			weak: 0,
			copy: 1,
			native: 2
		};
		var curStrength = "copy";
		var packet = emptyPacket();
		function residentKey() {
			try {
				var _ck = window.__tmCore && window.__tmCore.key();
				if (_ck) return _ck;
			} catch (e) {}
			try {
				var els = document.querySelectorAll("span, div, h1, h2, h3, td, a, b, strong");
				for (var i = 0; i < els.length; i++) {
					var tx = (els[i].textContent || "").replace(/\s+/g, " ").trim();
					if (tx.length > 70 || tx.length < 5) continue;
					if (/^clinical\s/i.test(tx)) continue;
					var em = tx.match(/^[A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?\s*\(\s*([A-Za-z]{0,5}\d{3,})\s*\)/);
					if (em) return "chart:" + em[1].toUpperCase();
				}
			} catch (e) {}
			var m = location.href.match(/ESOLclientid=(EID_[A-Za-z0-9]+)/);
			if (m) return "eid:" + m[1];
			var as = document.querySelectorAll("a[href*=\"ESOLclientid=\"]");
			for (var i = 0; i < as.length; i++) {
				var mm = (as[i].getAttribute("href") || "").match(/ESOLclientid=(EID_[A-Za-z0-9]+)/);
				if (mm) return "eid:" + mm[1];
			}
			return null;
		}
		var storeKey = null;
		function refreshKey() {
			try {
				if (storeKey && storeKey.indexOf("chart:") === 0) return;
				var k = residentKey();
				if (k && k.indexOf("chart:") === 0 && k !== storeKey) {
					storeKey = k;
					loadStored();
					mergeStored();
					publish();
				}
			} catch (e) {}
		}
		function badRelations(stop) {
			return !!(stop && stop.summary && /^relationships\b[\s:—–-]*$/i.test(norm(stop.summary)));
		}
		function loadStored() {
			try {
				storeKey = residentKey();
				if (!storeKey) return;
				var raw = localStorage.getItem("tmGatherV2:" + storeKey);
				if (!raw) return;
				var stored = JSON.parse(raw);
				if (!stored || !stored.stops) return;
				if (stored.v !== 4) return;
				STOP_KEYS.forEach(function(k) {
					if (stored.stops[k] && stored.stops[k].status === "landed") {
						if (k === "relations" && badRelations(stored.stops[k])) return;
						packet.stops[k] = stored.stops[k];
					}
				});
			} catch (e) {}
		}
		function mergeStored() {
			try {
				if (!storeKey) storeKey = residentKey();
				if (!storeKey) return;
				var raw = localStorage.getItem("tmGatherV2:" + storeKey);
				if (!raw) return;
				var stored = JSON.parse(raw);
				if (!stored || !stored.stops) return;
				if (stored.v !== 4) return;
				var changed = false;
				STOP_KEYS.forEach(function(k) {
					if (packet.stops[k].status !== "landed" && stored.stops[k] && stored.stops[k].status === "landed") {
						if (k === "relations" && badRelations(stored.stops[k])) return;
						packet.stops[k] = stored.stops[k];
						changed = true;
					}
				});
				if (changed) publish();
			} catch (e) {}
		}
		function feedBimsTile(stop) {
			try {
				if (!stop || !stop.series || !stop.series[0]) return;
				var s0 = stop.series[0];
				var d = new Date(s0.date);
				if (isNaN(d.getTime())) return;
				var val = s0.score + " on " + (d.getMonth() + 1) + "/" + d.getDate() + "/" + String(d.getFullYear()).slice(2);
				feedEvent({ bims: val });
				var k = storeKey || residentKey();
				if (k) localStorage.setItem("tmBimsFor:" + k, JSON.stringify({
					value: val,
					ts: Date.now()
				}));
			} catch (e) {}
		}
		function saveStored() {
			try {
				if (!storeKey) storeKey = residentKey();
				if (!storeKey) return;
				var out = {
					v: packet.v,
					startedAt: packet.startedAt,
					stops: {}
				};
				STOP_KEYS.forEach(function(k) {
					var st = packet.stops[k];
					out.stops[k] = st && st.status === "landed" && st.strength === "weak" ? {
						status: "not-loaded",
						source: "",
						at: "",
						strength: ""
					} : st;
				});
				localStorage.setItem("tmGatherV2:" + storeKey, JSON.stringify(out));
			} catch (e) {}
		}
		var settleOpen = true;
		function publish(force) {
			var node = document.getElementById(NODE_ID);
			if (!node) {
				node = document.createElement("script");
				node.type = "application/json";
				node.id = NODE_ID;
				node.style.display = "none";
				(document.body || document.documentElement).appendChild(node);
				feedFromPacket();
			}
			node.textContent = JSON.stringify(packet);
			if (force || settleOpen) try {
				document.dispatchEvent(new CustomEvent("tm-gather-update"));
			} catch (e) {}
		}
		function land(key, data) {
			if (stopped) return;
			if (!data.strength) data.strength = curStrength;
			var cur = packet.stops[key];
			if (cur && cur.status === "landed") {
				if ((STR_RANK[data.strength] || 0) <= (STR_RANK[cur.strength || "copy"] || 0)) return;
			}
			data.status = "landed";
			packet.stops[key] = data;
			publish();
			saveStored();
		}
		function fmtAllergies(raw) {
			if (!raw) return "";
			var cleaned = raw.trim();
			if (/^no\s+known\s+(?:drug\s+)?allergies/i.test(cleaned) || /^nkda?/i.test(cleaned)) return "NKA";
			var list = cleaned.split(/[,;\/\n]+/);
			var out = [];
			for (var i = 0; i < list.length; i++) {
				var item = list[i].replace(/\s+/g, " ").trim();
				item = item.replace(/(?:Copy|Copied)$/i, "").trim();
				if (!item) continue;
				item = item.replace(/\bpen[ie]cill?in\b/gi, "PCN");
				out.push(item);
			}
			return out.join(", ");
		}
		function isCrownHeights(doc) {
			try {
				var els = doc.querySelectorAll("select, button, a, span, div, td");
				for (var i = 0; i < els.length; i++) {
					var tx = (els[i].textContent || "").trim();
					if (tx.length > 90 || tx.length < 6) continue;
					if (!/crown\s*heights/i.test(tx)) continue;
					return true;
				}
			} catch (e) {}
			return false;
		}
		function roomBedNumber(doc, withWing) {
			try {
				var t = doc.body && doc.body.textContent ? doc.body.textContent : "";
				var v = "";
				var m = t.match(/\bLocation\s*:?\s*([^\n]*?)(?=\s*(?:Status|Code Status|Physician|DOB|Admission|Initial Admission|Discharge|Allergies|Special Instructions)\b|\n|$)/);
				if (m) v = m[1].replace(/\s+/g, " ").trim();
				if (!v) {
					var li = t.search(/\bLocation\b/i);
					if (li !== -1) v = t.substr(li, 40).replace(/\s+/g, " ").trim();
				}
				var rm = v.match(/\b(\d{2,4})\s*-?\s*([A-Za-z])?\b/);
				if (!rm) return "";
				var pre = "";
				if (withWing) {
					var tok = v.slice(0, rm.index).match(/([A-Za-z]+)\s*$/);
					if (tok && /^(east|west)$/i.test(tok[1])) pre = tok[1].charAt(0).toUpperCase();
					else if (tok && tok[1].length === 1 && /[ew]/i.test(tok[1])) pre = tok[1].toUpperCase();
				}
				return pre + rm[1] + (rm[2] ? rm[2].toUpperCase() : "");
			} catch (e) {
				return "";
			}
		}
		function weightBlock(doc) {
			var blocks = doc.querySelectorAll(".vitalDetails");
			for (var i = 0; i < blocks.length; i++) {
				var b = blocks[i].querySelector("b");
				var v = blocks[i].querySelector(".vitalValue");
				if (b && v && /^weight$/i.test((b.textContent || "").trim())) {
					var m = (v.textContent || "").match(/([\d.]+)\s*lbs/i);
					if (m) {
						var td = blocks[i].closest ? blocks[i].closest("td") : null;
						return {
							value: m[1] + " lbs",
							flagged: !!(td && td.classList && td.classList.contains("vitalWithException"))
						};
					}
				}
			}
			return null;
		}
		function selfHeader(doc) {
			var out = {};
			try {
				var t = doc.body && doc.body.textContent ? doc.body.textContent : "";
				var m = t.match(/\((\d{1,3})\/(Male|Female)\)/);
				if (m) out.ageSex = m[1] + (m[2] === "Male" ? "M" : "F");
				var room = roomBedNumber(doc, isCrownHeights(doc));
				if (room) out.room = room;
				var al = doc.querySelector(".residentAllergies .residentDetailValue");
				if (al) {
					var fa = fmtAllergies((al.textContent || "").trim());
					if (fa) out.allergies = fa;
				}
				var a1 = t.match(/Admission\s*\(re-?entry\)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
				if (a1) {
					out.admission = a1[1];
					out.admReentry = a1[1];
				}
				var a2 = t.match(/Initial Admission Date[^0-9]*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
				if (a2) {
					out.admInitial = a2[1];
					if (!out.admission) out.admission = a2[1];
				}
				var a3 = t.match(/Discharge Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
				if (a3) out.admDischarge = a3[1];
				var wb = weightBlock(doc);
				if (wb) {
					out.weight = wb.value;
					if (wb.flagged) out.weightFlagged = true;
				}
				var mbox = doc.getElementById("medListBox");
				if (mbox) {
					var mdivs = mbox.querySelectorAll("div");
					var mlines = [];
					for (var mi = 1; mi < mdivs.length; mi++) {
						var mtx = (mdivs[mi].textContent || "").trim();
						if (mtx.indexOf("⚠ REVIEW") === 0) break;
						if (mtx) mlines.push(mtx);
					}
					if (mlines.length) out.medsList = mlines.join("\n").slice(0, 2e3);
				}
				var btn = doc.getElementById("copyMedListBtn");
				if (btn) {
					var bNode = btn.parentElement;
					for (var bUp = 0; bUp < 3 && bNode; bUp++) {
						var bTx = norm(bNode.textContent);
						if (/psych med list/i.test(bTx) && bTx.length > 30) {
							var meds2 = bTx.replace(/^Psych med list\s*(Copy\s*)?/i, "").trim();
							if (meds2) {
								out.psychMeds = meds2.slice(0, 300);
								break;
							}
						}
						bNode = bNode.parentElement;
					}
				}
			} catch (e) {}
			return out;
		}
		function readTile(titleRx, maxLen) {
			var wrap = document.getElementById("pnTilesWrap");
			if (!wrap) return null;
			var tiles = wrap.children;
			for (var i = 0; i < tiles.length; i++) {
				var tx = norm(tiles[i].textContent);
				if (titleRx.test(tx)) return tx.slice(0, maxLen);
			}
			return null;
		}
		function readWeightsPage(doc) {
			if (!/Weights and Vitals/i.test(doc.title || "")) return null;
			var tables = doc.querySelectorAll("table");
			for (var ti = 0; ti < tables.length; ti++) {
				var trows = tables[ti].querySelectorAll("tr");
				if (!trows.length) continue;
				var headCells = trows[0].cells ? Array.prototype.map.call(trows[0].cells, txt) : [];
				var wIdx = headCells.findIndex(function(c) {
					return /weight/i.test(c);
				});
				var dIdx = headCells.findIndex(function(c) {
					return /date/i.test(c);
				});
				if (wIdx < 0) continue;
				var pts = [];
				for (var i = 1; i < trows.length; i++) {
					var cells = trows[i].cells ? Array.prototype.map.call(trows[i].cells, txt) : [];
					var wv = parseFloat((cells[wIdx] || "").replace(/[^\d.]/g, ""));
					var dm = (dIdx >= 0 ? cells[dIdx] || "" : cells.find(function(c) {
						return /\d{1,2}\/\d{1,2}\/\d{4}/.test(c);
					}) || "").match(/\d{1,2}\/\d{1,2}\/\d{4}/);
					if (dm && wv >= 50 && wv <= 700) pts.push({
						date: dm[0],
						weight: wv
					});
				}
				if (pts.length >= 2) return pts.slice(0, 40);
			}
			return null;
		}
		function gatherPage() {
			if (stopped) return;
			mergeStored();
			curStrength = "native";
			var h = selfHeader(document);
			if (Object.keys(h).length >= 2) land("header", {
				source: "Dash",
				at: nowT(),
				facts: h
			});
			var b = readTile(/^Behaviors?\b/i, 700);
			var behBox = document.getElementById("pnBehBox");
			if (behBox) b = norm(behBox.textContent).slice(0, 700);
			var bev = [];
			try {
				bev = window.__tmBehEvents ? window.__tmBehEvents.extract(document) : [];
			} catch (e) {}
			if (b || bev.length) land("behaviors", {
				source: "Progress Notes",
				at: nowT(),
				summary: b || "",
				events: bev.slice(0, 400)
			});
			var dx = readTile(/^Diagnoses\b/i, 700);
			var dxBox = document.getElementById("pnDxBox");
			if (dxBox) dx = norm(dxBox.textContent).slice(0, 700);
			if (dx) land("diagnoses", {
				source: "Progress Notes",
				at: nowT(),
				summary: dx
			});
			var wp = readWeightsPage(document);
			if (wp) land("weights", {
				source: "Wts/Vitals",
				at: nowT(),
				series: wp,
				summary: wp.length + " dated weights; latest " + wp[0].weight + " lbs on " + wp[0].date
			});
			try {
				parseAssessments(document);
			} catch (e) {}
			try {
				readMdsSectionPage(document);
			} catch (e) {}
			try {
				parseOpenedConsult(document);
			} catch (e) {}
			try {
				parseLabReport(document);
			} catch (e) {}
			try {
				parseProfile(document);
			} catch (e) {}
			try {
				parseOrders(document);
			} catch (e) {}
			try {
				parseResults(document);
			} catch (e) {}
		}
		function gatherCtx() {
			return {
				land,
				publish,
				saveStored,
				nowT,
				norm,
				txt,
				feedRowTile,
				residentKey,
				get packet() {
					return packet;
				},
				get storeKey() {
					return storeKey;
				},
				get strength() {
					return curStrength;
				}
			};
		}
		function strengthFor(reader, doc) {
			if (!doc || doc !== document) return "copy";
			var h = location.href;
			if (reader === "profile") return /careclientprofile/i.test(h) ? "native" : "copy";
			if (reader === "assess") return /cp_assessment|assessments|mdssection/i.test(h) ? "native" : "copy";
			if (reader === "results") return /resultsportal|labresults/i.test(h) ? "native" : "copy";
			if (reader === "orders") return /orders/i.test(h) ? "native" : "copy";
			return "copy";
		}
		function parseAssessments(doc) {
			var r = window.__tmReaders;
			if (r && r.parseAssessments) {
				curStrength = strengthFor("assess", doc);
				return r.parseAssessments(doc, gatherCtx());
			}
		}
		function parseOpenedConsult(doc) {
			var r = window.__tmReaders;
			if (r && r.parseOpenedConsult) {
				curStrength = strengthFor("assess", doc);
				return r.parseOpenedConsult(doc, gatherCtx());
			}
		}
		function parseLabReport(doc) {
			var r = window.__tmReaders;
			if (r && r.parseLabReport) {
				curStrength = strengthFor("results", doc);
				return r.parseLabReport(doc, gatherCtx());
			}
		}
		function parseProfile(doc) {
			var r = window.__tmReaders;
			if (r && r.parseProfile) {
				curStrength = strengthFor("profile", doc);
				return r.parseProfile(doc, gatherCtx());
			}
		}
		function parseResults(doc) {
			var r = window.__tmReaders;
			if (r && r.parseResults) {
				curStrength = strengthFor("results", doc);
				return r.parseResults(doc, gatherCtx());
			}
		}
		function parseOrders(doc) {
			var r = window.__tmReaders;
			if (r && r.parseOrders) {
				curStrength = strengthFor("orders", doc);
				return r.parseOrders(doc, gatherCtx());
			}
		}
		function stampBimsWhy(s) {
			try {
				packet.stops.bims.why = s;
				publish();
			} catch (e) {}
		}
		function landSectionParse(doc, fallbackDate, strength) {
			var r = window.__tmReaders;
			if (!r || !r.parseMdsHeader) return false;
			var hdr = r.parseMdsHeader(doc);
			if (!hdr) return false;
			if (hdr.score !== 99) {
				var bp = r.parseBpBimsItems(doc);
				if (bp && bp.score !== hdr.score) {
					stampBimsWhy("mds chain: header " + hdr.score + " != BP items " + bp.score);
					return false;
				}
				var cn = r.cnrItemSum(doc);
				if (cn !== null && cn !== void 0 && cn !== hdr.score) {
					stampBimsWhy("mds chain: header " + hdr.score + " != CNR items " + cn);
					return false;
				}
			}
			var date = hdr.date || fallbackDate;
			if (!date) return false;
			r.mergeBimsPoint(gatherCtx(), {
				date,
				score: hdr.score
			}, strength);
			return true;
		}
		function sectionLinkOf(doc) {
			var as = doc.querySelectorAll("a[href*=\"mdssection.jsp\"]");
			var custB = null, all = [];
			for (var i = 0; i < as.length; i++) {
				var h = as[i].getAttribute("href") || "";
				if (/^javascript:/i.test(h)) continue;
				all.push(h);
				if (/ESOLsectioncode=Cust_B/.test(h)) custB = h;
			}
			return custB || (all.length === 1 ? all[0] : null);
		}
		var bimsChainRan = false;
		function chainBimsFromList(listDoc, listUrl) {
			if (bimsChainRan || stopped) return;
			bimsChainRan = true;
			var r = window.__tmReaders;
			if (!r || !r.findBimsViewLinks) return;
			var strength = curStrength;
			function mergeListPoints(doc) {
				if (!r.bimsPointsFromList || !r.mergeBimsPoint) return 0;
				var bp = r.bimsPointsFromList(doc);
				if (!bp || !bp.points.length) return 0;
				var G = gatherCtx();
				for (var i = 0; i < bp.points.length; i++) r.mergeBimsPoint(G, bp.points[i], strength);
				return bp.points.length;
			}
			var found = r.findBimsViewLinks(listDoc);
			var census = found.census;
			var chainLinks = found.links.length ? found.links : null;
			var typeIds = r.findBimsTypeIds ? r.findBimsTypeIds(listDoc) : [];
			var pointsFound = 0;
			var ti = 0;
			(function tryType() {
				if (stopped) return;
				if (ti >= typeIds.length) {
					afterFamily();
					return;
				}
				var url = listUrlWithType(listUrl, typeIds[ti++]);
				if (!url) {
					tryType();
					return;
				}
				fetchDoc(url).then(function(tdoc) {
					if (stopped) return;
					pointsFound += mergeListPoints(tdoc);
					var tf = r.findBimsViewLinks(tdoc);
					census.rows += tf.census.rows;
					census.carriers += tf.census.carriers;
					census.anchors += tf.census.anchors;
					if (tf.links.length && !chainLinks) chainLinks = tf.links;
					tryType();
				}).catch(function() {
					tryType();
				});
			})();
			function afterFamily() {
				if (chainLinks) tryChainLinks(chainLinks, strength);
				if (pointsFound > 0) return;
				sweepTypes();
			}
			function sweepTypes() {
				if (!r.allTypeIds) {
					stampBimsWhy("mds chain: rows=" + census.rows + " carriers=" + census.carriers + " types=" + ti + " anchors=" + census.anchors);
					return;
				}
				var done = {};
				for (var i = 0; i < typeIds.length; i++) done[typeIds[i]] = true;
				var sel = listDoc.querySelector("select[name=\"ESOLstdassessid\"]");
				if (sel && sel.options[sel.selectedIndex]) done[sel.options[sel.selectedIndex].getAttribute("value") || ""] = true;
				var rest = r.allTypeIds(listDoc).filter(function(id) {
					return !done[id];
				});
				var si = 0, swept = 0, sPoints = 0, sLinks = null;
				(function nextSweep() {
					if (stopped) return;
					if (si >= rest.length) {
						if (!packet.stops.bims || packet.stops.bims.status !== "landed") stampBimsWhy("mds chain: rows=" + census.rows + " carriers=" + census.carriers + " types=" + ti + " sweep=" + swept + " anchors=" + census.anchors);
						if (sLinks) tryChainLinks(sLinks, strength);
						return;
					}
					var url = listUrlWithType(listUrl, rest[si++]);
					if (!url) {
						nextSweep();
						return;
					}
					fetchDoc(url).then(function(tdoc) {
						if (stopped) return;
						swept++;
						sPoints += mergeListPoints(tdoc);
						if (!sLinks) {
							var tf = r.findBimsViewLinks(tdoc);
							if (tf.links.length) sLinks = tf.links;
						}
						nextSweep();
					}).catch(function() {
						nextSweep();
					});
				})();
			}
		}
		function tryChainLinks(foundLinks, strength) {
			var links = foundLinks.slice(0, 3);
			var i = 0;
			(function next() {
				if (stopped) return;
				if (i >= links.length) {
					stampBimsWhy("mds chain: carriers tried=" + links.length + ", none parsed");
					return;
				}
				var cand = links[i++];
				fetchDoc(cand.href).then(function(doc2) {
					if (stopped) return;
					if (/mdssection\.jsp/i.test(cand.href) && landSectionParse(doc2, cand.date, strength)) return;
					var sec = sectionLinkOf(doc2);
					if (!sec) {
						next();
						return;
					}
					fetchDoc(sec).then(function(doc3) {
						if (!stopped && !landSectionParse(doc3, cand.date, strength)) next();
					}).catch(function() {
						next();
					});
				}).catch(function() {
					next();
				});
			})();
		}
		function parseAssessmentsThenChain(doc, listUrl) {
			parseAssessments(doc);
			chainBimsFromList(doc, listUrl);
		}
		function readMdsSectionPage(doc) {
			if (!/mdssection\.jsp/i.test(location.href)) return;
			curStrength = strengthFor("assess", doc);
			landSectionParse(doc, null, curStrength);
		}
		function discoverUrls() {
			var want = [
				{
					key: "assess",
					label: /assmnts|assessments/i,
					href: /cp_assessment|assessments/i
				},
				{
					key: "profile",
					label: /^profile$/i,
					href: /careclientprofile/i
				},
				{
					key: "results",
					label: /results/i,
					href: /resultsportal|labresults/i
				},
				{
					key: "orders",
					label: /orders/i,
					href: /orders/i
				},
				{
					key: "weights",
					label: /wts|weights/i,
					href: /weightsandvitals/i
				},
				{
					key: "notes",
					label: /prog/i,
					href: /progressnotesviewall|progressnotes\.xhtml/i
				}
			];
			var map = {};
			var anchors = document.querySelectorAll("a[href]");
			function accept(a) {
				var h = a.getAttribute("href") || "";
				if (/editmyprofile|myprofile/i.test(h)) return null;
				try {
					return new URL(h, location.href).href;
				} catch (e) {
					return null;
				}
			}
			for (var p = 0; p < 2; p++) for (var i = 0; i < anchors.length; i++) {
				var a = anchors[i];
				var href = a.getAttribute("href") || "";
				var label = norm(a.textContent);
				for (var j = 0; j < want.length; j++) {
					var w = want[j];
					if (map[w.key]) continue;
					if (p === 0 ? w.href.test(href) : label && label.length <= 24 && w.label.test(label)) {
						var u = accept(a);
						if (u) map[w.key] = u;
					}
				}
			}
			return map;
		}
		var controllers = [];
		var fetchLog = [];
		function noteFetch(key, url, doc, err) {
			var line = {
				key,
				at: nowT(),
				url: (url || "").split("?")[0].split("/").pop()
			};
			if (err) line.error = String(err).slice(0, 60);
			if (doc) {
				line.title = (doc.title || "").slice(0, 40);
				line.tables = doc.querySelectorAll ? doc.querySelectorAll("table").length : 0;
				line.bytes = doc.documentElement ? (doc.documentElement.outerHTML || "").length : 0;
			}
			fetchLog.push(line);
			if (fetchLog.length > 14) fetchLog.shift();
			packet.fetchLog = fetchLog;
			publish();
		}
		function fetchDoc(url) {
			var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
			if (ctl) {
				controllers.push(ctl);
				setTimeout(function() {
					try {
						ctl.abort();
					} catch (e) {}
				}, 12e3);
			}
			return fetch(url, {
				credentials: "same-origin",
				signal: ctl ? ctl.signal : void 0
			}).then(function(r) {
				return r.text();
			}).then(function(html) {
				return new DOMParser().parseFromString(html, "text/html");
			});
		}
		var fedSent = {};
		function feedEvent(detail) {
			var keys = Object.keys(detail);
			for (var i = 0; i < keys.length; i++) {
				if (fedSent[keys[i]] === detail[keys[i]]) return;
				fedSent[keys[i]] = detail[keys[i]];
			}
			try {
				document.dispatchEvent(new CustomEvent("tm-gather-feed", { detail }));
			} catch (e) {}
		}
		function bimsLine(stop) {
			if (!stop || !stop.series || !stop.series[0]) return "";
			var s0 = stop.series[0];
			var d = new Date(s0.date);
			if (isNaN(d.getTime())) return "";
			return s0.score + " on " + (d.getMonth() + 1) + "/" + d.getDate() + "/" + String(d.getFullYear()).slice(2);
		}
		function feedFromPacket(force) {
			if (force) fedSent = {};
			var s = packet.stops;
			if (s.relations.status === "landed" && s.relations.summary) feedEvent({ rel: s.relations.summary });
			if (s.bims.status === "landed") {
				var bl = bimsLine(s.bims);
				if (bl) feedEvent({ bims: bl });
			}
			var ml = s.header.status === "landed" && s.header.medsList ? s.header.medsList : s.dashmeds && s.dashmeds.status === "landed" && s.dashmeds.lines ? s.dashmeds.lines : "";
			if (ml) feedEvent({ meds: ml });
		}
		function feedRowTile(summary) {
			feedEvent({ rel: summary });
			try {
				localStorage.setItem("pccFillRelationships", JSON.stringify({
					value: summary,
					ts: Date.now()
				}));
			} catch (e) {}
			try {
				var k = storeKey || residentKey();
				if (k) localStorage.setItem("tmRelFor:" + k, JSON.stringify({
					value: summary,
					ts: Date.now()
				}));
			} catch (e) {}
		}
		function parseNotesPage(doc) {
			if (!doc || !doc.getElementById) return;
			var dxBox = doc.getElementById("pnDxBox");
			if (dxBox) {
				var dx = norm(dxBox.textContent).slice(0, 700);
				if (dx) land("diagnoses", {
					source: "Progress Notes",
					at: nowT(),
					summary: dx
				});
			}
			var behBox = doc.getElementById("pnBehBox");
			var b2 = behBox ? norm(behBox.textContent).slice(0, 700) : "";
			var bev2 = [];
			try {
				bev2 = window.__tmBehEvents ? window.__tmBehEvents.extract(doc) : [];
			} catch (e) {}
			if (b2 || bev2.length) land("behaviors", {
				source: "Progress Notes",
				at: nowT(),
				summary: b2,
				events: bev2.slice(0, 400)
			});
		}
		function notesUrl(urls) {
			if (urls.notes) {
				if (/progressnotesviewall/i.test(urls.notes)) return urls.notes;
				var u = urls.notes.replace(/progressnotes\.xhtml/i, "progressnotesviewall.xhtml");
				var setP = function(url, name, val) {
					var re = new RegExp("([?&])" + name + "=[^&]*");
					return re.test(url) ? url.replace(re, "$1" + name + "=" + val) : url + (url.indexOf("?") === -1 ? "?" : "&") + name + "=" + val;
				};
				return setP(setP(u, "ESOLshowEMARPN", "Y"), "viewAllOption", "0");
			}
			var eid = null;
			var m = location.href.match(/ESOLclientid=(EID_[A-Za-z0-9]+)/);
			if (m) eid = m[1];
			if (!eid) {
				var as = document.querySelectorAll("a[href*=\"ESOLclientid=\"]");
				for (var i = 0; i < as.length; i++) {
					var mm = (as[i].getAttribute("href") || "").match(/ESOLclientid=(EID_[A-Za-z0-9]+)/);
					if (mm) {
						eid = mm[1];
						break;
					}
				}
			}
			if (!eid) return "";
			return location.origin + "/clinical/client/progressnotesviewall.xhtml?ESOLclientid=" + eid + "&ESOLshowEMARPN=Y&viewAllOption=0";
		}
		function parseWeights(doc) {
			var wp = readWeightsPage(doc);
			if (wp) land("weights", {
				source: "Wts/Vitals",
				at: nowT(),
				series: wp,
				summary: wp.length + " dated weights; latest " + wp[0].weight + " lbs on " + wp[0].date
			});
		}
		var lastFetchAt = 0;
		function allTypesUrl(u) {
			if (!u) return u;
			function setParam(url, name, val) {
				var re = new RegExp("([?&])" + name + "=[^&]*");
				if (re.test(url)) return url.replace(re, "$1" + name + "=" + val);
				return url + (url.indexOf("?") === -1 ? "?" : "&") + name + "=" + val;
			}
			return setParam(setParam(u, "ESOLstdassessid", "-1"), "ESOLstatusFilter", "");
		}
		function listUrlWithType(u, id) {
			if (!u) return u;
			var re = /([?&])ESOLstdassessid=[^&]*/;
			if (re.test(u)) return u.replace(re, "$1ESOLstdassessid=" + id);
			return u + (u.indexOf("?") === -1 ? "?" : "&") + "ESOLstdassessid=" + id;
		}
		function gatherFetches() {
			refreshKey();
			if (stopped) return;
			var now = Date.now();
			if (now - lastFetchAt < 4e3) return;
			var urls = discoverUrls();
			var jobs = [];
			function add(key, url, fn, stops) {
				if (!url) return;
				if (!stops.some(function(s) {
					return packet.stops[s].status !== "landed";
				})) return;
				jobs.push(fetchDoc(url).then(function(doc) {
					noteFetch(key, url, doc);
					if (!stopped) {
						curStrength = "copy";
						fn(doc);
					}
				}).catch(function(e) {
					noteFetch(key, url, null, e);
				}));
			}
			var assessListUrl = allTypesUrl(urls.assess);
			add("assess", assessListUrl, function(doc) {
				parseAssessmentsThenChain(doc, assessListUrl);
			}, ["ownnotes"]);
			add("assessbims", assessListUrl, function(doc) {
				chainBimsFromList(doc, assessListUrl);
			}, ["bims"]);
			add("profile", urls.profile, parseProfile, ["relations"]);
			add("results", urls.results, parseResults, ["labs"]);
			add("orders", urls.orders, parseOrders, ["orders"]);
			add("weights", urls.weights, parseWeights, ["weights"]);
			add("notes", notesUrl(urls), parseNotesPage, ["diagnoses", "behaviors"]);
			if (!(packet.stops.header.medsList || packet.stops.dashmeds && packet.stops.dashmeds.status === "landed")) {
				var eid = null;
				var dashLink = document.querySelector("a[href*=\"cp_residentdashboard.jsp?ESOLclientid=\"]");
				if (dashLink) {
					var dm = (dashLink.getAttribute("href") || "").match(/ESOLclientid=(EID_[A-Za-z0-9]+)/);
					if (dm) eid = dm[1];
				}
				if (!eid) {
					var em2 = location.href.match(/ESOLclientid=(EID_[A-Za-z0-9]+)/);
					if (em2) eid = em2[1];
				}
				if (!eid) {
					var as2 = document.querySelectorAll("a[href*=\"ESOLclientid=\"]");
					for (var ai2 = 0; ai2 < as2.length; ai2++) {
						var mm2 = (as2[ai2].getAttribute("href") || "").match(/ESOLclientid=(EID_[A-Za-z0-9]+)/);
						if (mm2) {
							eid = mm2[1];
							break;
						}
					}
				}
				if (!eid) {
					var hm = document.documentElement.innerHTML.match(/ESOLclientid=(EID_[A-Za-z0-9]+)/);
					if (hm) eid = hm[1];
				}
				var shellUrl = "";
				try {
					if (/cp_residentdashboard\.jsp/.test(window.top.location.href)) shellUrl = window.top.location.href;
				} catch (e) {}
				if (!shellUrl && eid) shellUrl = location.origin + "/admin/client/cp_residentdashboard.jsp?ESOLclientid=" + eid;
				if (eid || shellUrl) jobs.push((function() {
					function curateAndLand(medDoc, tag) {
						if (stopped || !medDoc) return false;
						var hasFn = typeof window.__tmDashCurateMeds === "function";
						var cur = null;
						if (hasFn) try {
							cur = window.__tmDashCurateMeds(medDoc);
						} catch (e) {
							cur = null;
						}
						if (!cur) {
							try {
								packet.stops.dashmeds.why = !hasFn ? "export-missing" : "curate-null (tables=" + (medDoc.querySelectorAll ? medDoc.querySelectorAll("table").length : "?") + ", scrollTable=" + (medDoc.querySelector && medDoc.querySelector("table.scrollTable") ? "yes" : "no") + ")";
								publish();
							} catch (e) {}
							return false;
						}
						land("dashmeds", {
							source: "Dash (fetched)",
							at: nowT(),
							strength: "native",
							lines: cur.slice(0, 2e3),
							summary: "curated psych meds (Dash format)"
						});
						return true;
					}
					function shellHop() {
						if (!shellUrl) return;
						return fetchDoc(shellUrl).then(function(dashDoc) {
							noteFetch("dash", shellUrl, dashDoc);
							if (stopped || !dashDoc) return;
							var frames = dashDoc.querySelectorAll("iframe");
							var medsUrl = "";
							for (var fi = 0; fi < frames.length; fi++) {
								var fsrc = frames[fi].getAttribute("src") || frames[fi].getAttribute("data-src") || "";
								if (/res_medications\.jsp/.test(fsrc)) {
									try {
										medsUrl = new URL(fsrc, shellUrl).href;
									} catch (e) {}
									break;
								}
							}
							if (!medsUrl) return;
							return fetchDoc(medsUrl).then(function(medDoc) {
								noteFetch("dashmeds", medsUrl, medDoc);
								curateAndLand(medDoc, "shell");
							});
						}).catch(function(e) {
							noteFetch("dash", shellUrl, null, e);
						});
					}
					if (!eid) return shellHop();
					var directUrl = location.origin + "/care/dashboards/res_medications.jsp?ESOLviewId=25&ESOLtitle=Medications&ESOLtabtype=C&ESOLclientid=" + eid + "&ESOLcolspan=2";
					return fetchDoc(directUrl).then(function(medDoc) {
						noteFetch("dashmeds", directUrl, medDoc);
						if (!curateAndLand(medDoc, "direct")) return shellHop();
					}).catch(function() {
						return shellHop();
					});
				})());
			}
			if (jobs.length) {
				lastFetchAt = now;
				Promise.allSettled(jobs);
			}
		}
		document.addEventListener("keydown", function(e) {
			if (e.key !== "0" || e.metaKey || e.ctrlKey || e.altKey) return;
			var t = e.target;
			if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable)) return;
			stopped = true;
			controllers.forEach(function(c) {
				try {
					c.abort();
				} catch (err) {}
			});
		}, true);
		document.addEventListener("click", function() {
			gatherPage();
			gatherFetches();
			feedFromPacket(true);
			publish(true);
		}, true);
		document.addEventListener("keydown", function(e) {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			var t = e.target;
			if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT" || t.isContentEditable)) return;
			publish(true);
		}, true);
		loadStored();
		if (packet.stops.relations.status === "landed") feedEvent({ rel: packet.stops.relations.summary });
		if (packet.stops.bims.status === "landed") feedBimsTile(packet.stops.bims);
		window.__tmCore.ladder(function(ms) {
			gatherPage();
			gatherFetches();
			if (ms === 3e3) {
				feedFromPacket(true);
				publish(true);
				settleOpen = false;
				try {
					window.__tmCore.settle();
				} catch (e) {}
			}
		}, [
			0,
			600,
			1500,
			3e3
		]);
		publish();
		window.addEventListener("storage", function(e) {
			if (!e.key || e.key.indexOf("tmGatherV2:") !== 0) return;
			try {
				mergeStored();
			} catch (err) {}
		});
		try {
			window.__tmGather = {
				packet,
				key: residentKey,
				parseAssessments,
				parseProfile,
				parseResults,
				parseOrders,
				land,
				gatherFetches
			};
		} catch (e) {}
	})();
	(function() {
		"use strict";
		function ctxt(el) {
			if (!el) return "";
			var c = el.cloneNode(true);
			var junk = c.querySelectorAll("script, style, pre");
			for (var i = 0; i < junk.length; i++) junk[i].remove();
			return (c.textContent || "").replace(/\s+/g, " ").trim();
		}
		function firstDate(cells) {
			for (var i = 0; i < cells.length; i++) {
				var m = cells[i].match(/\d{1,2}\/\d{1,2}\/\d{4}/);
				if (m) return m[0];
			}
			return "";
		}
		var BIMS_RE = /BIMS|cognitive|cognitively|impair|intact/i;
		var PSYCH_RE = /psychiatr|psych\s*:|psych\s+consult/i;
		var MDACK_RE = /MD:\s*Psychiatry\s+Consult\s+Ack/i;
		var SCORE_RE = /^\d{1,2}(\.\d+)?$/;
		function bimsPointsFromList(doc) {
			var heads = doc.querySelectorAll("th, td");
			var hasScore = false;
			for (var i = 0; i < heads.length; i++) if (/^Score$/i.test(ctxt(heads[i]))) {
				hasScore = true;
				break;
			}
			if (!hasScore) return null;
			var points = [], rowsSeen = 0;
			var rows = doc.querySelectorAll("tr");
			for (var r = 0; r < rows.length; r++) {
				var row = rows[r];
				if (!row.cells || row.cells.length < 6 || row.querySelector("tr")) continue;
				var t = Array.prototype.map.call(row.cells, ctxt);
				var dateStr = firstDate(t);
				if (!dateStr) continue;
				var rowText = t.join(" | ");
				if (MDACK_RE.test(rowText) || PSYCH_RE.test(rowText)) continue;
				var score = t.find(function(c) {
					return SCORE_RE.test(c);
				});
				if (score === void 0) continue;
				if (!t.some(function(c) {
					return BIMS_RE.test(c);
				})) continue;
				rowsSeen++;
				var n = parseFloat(score);
				if (n >= 0 && n <= 15 || n === 99) points.push({
					date: dateStr,
					score: n
				});
			}
			points.sort(function(a, b2) {
				return new Date(b2.date) - new Date(a.date);
			});
			return {
				points,
				rowsSeen
			};
		}
		function parseAssessments(doc, G) {
			var bp = bimsPointsFromList(doc);
			if (!bp) {
				try {
					if (G.packet.stops.bims.status !== "landed" && !/^mds chain:/.test(G.packet.stops.bims.why || "")) {
						G.packet.stops.bims.why = "no Score column in fetched list";
						G.publish();
					}
				} catch (e) {}
				return;
			}
			var bims = bp.points, bimsRowsSeen = bp.rowsSeen;
			var visits = [], mdAck = "";
			var rows = doc.querySelectorAll("tr");
			for (var r = 0; r < rows.length; r++) {
				var row = rows[r];
				if (!row.cells || row.cells.length < 6 || row.querySelector("tr")) continue;
				var t = Array.prototype.map.call(row.cells, ctxt);
				var dateStr = firstDate(t);
				if (!dateStr) continue;
				var rowText = t.join(" | ");
				if (MDACK_RE.test(rowText)) {
					if (!mdAck) mdAck = dateStr;
				} else if (PSYCH_RE.test(rowText)) visits.push(dateStr);
			}
			if (!bims.length) try {
				if (G.packet.stops.bims.status !== "landed" && !/^mds chain:/.test(G.packet.stops.bims.why || "")) {
					G.packet.stops.bims.why = "Score column present; BIMS-like rows matched=" + bimsRowsSeen + " (0 = the fetched list holds no BIMS rows)";
					G.publish();
				}
			} catch (e) {}
			if (bims.length) {
				bims.sort(function(a, b2) {
					return new Date(b2.date) - new Date(a.date);
				});
				G.land("bims", {
					source: "Assessments",
					at: G.nowT(),
					facts: { latest: bims[0].score + " on " + bims[0].date },
					series: bims.slice(0, 24),
					summary: "BIMS " + bims[0].score + " on " + bims[0].date + " · " + bims.length + " scored"
				});
			}
			if (visits.length || mdAck) G.land("ownnotes", {
				source: "Assessments",
				at: G.nowT(),
				summary: (visits.length ? "Your consults: " + visits.slice(0, 12).join(", ") : "") + (mdAck ? " · latest MD acknowledgement " + mdAck : "")
			});
			if (visits.length) landHisNotes(visits.map(function(d) {
				return {
					date: d,
					text: null,
					full: false
				};
			}), G);
		}
		function checkedValue(doc, name) {
			var els = doc.querySelectorAll("input[type=\"radio\"][name=\"" + name + "\"]");
			for (var i = 0; i < els.length; i++) if (els[i].checked) return els[i].getAttribute("value");
			return null;
		}
		function parseMdsHeader(doc) {
			var score = null;
			var as = doc.querySelectorAll("a[href*=\"launchDetailedScores\"]");
			for (var i = 0; i < as.length; i++) {
				var t = (as[i].textContent || "").trim();
				if (/^\d+(\.\d+)?$/.test(t)) score = parseFloat(t);
			}
			if (score === null || !(score >= 0 && score <= 15 || score === 99)) return null;
			var ad = doc.getElementById("assessDate");
			var m = ad && /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(ad.textContent || "");
			if (!m) return null;
			return {
				score,
				date: parseInt(m[1], 10) + "/" + parseInt(m[2], 10) + "/" + m[3]
			};
		}
		function parseBpBimsItems(doc) {
			if (checkedValue(doc, "Cust_B_BIMS_A") !== "1") return null;
			var sum = 0;
			for (var n = 1; n <= 7; n++) {
				var v = checkedValue(doc, "Cust_B_BIMS_" + n);
				if (v === null || !/^\d+$/.test(v)) return null;
				sum += parseInt(v, 10);
			}
			return { score: sum };
		}
		function cnrItemSum(doc) {
			if (checkedValue(doc, "Cust_Ins_1") !== "1") return null;
			var items = [
				"Cust_A_1",
				"Cust_B_1a",
				"Cust_B_2a",
				"Cust_B_3a",
				"Cust_C_1",
				"Cust_C_2",
				"Cust_C_3"
			];
			var sum = 0;
			for (var i = 0; i < items.length; i++) {
				var v = checkedValue(doc, items[i]);
				if (v === null || !/^\d+$/.test(v)) return null;
				sum += parseInt(v, 10);
			}
			return sum;
		}
		function findBimsViewLinks(doc) {
			var census = {
				rows: 0,
				carriers: 0,
				anchors: 0
			};
			var links = [];
			var rows = doc.querySelectorAll("tr");
			for (var r = 0; r < rows.length; r++) {
				var row = rows[r];
				if (!row.cells || row.cells.length < 5 || row.querySelector("tr")) continue;
				census.rows++;
				var t = Array.prototype.map.call(row.cells, ctxt);
				var dateStr = firstDate(t);
				if (!dateStr) continue;
				var rowText = t.join(" | ");
				if (PSYCH_RE.test(rowText) || MDACK_RE.test(rowText)) continue;
				if (!(/BIMS/i.test(rowText) || /Social Service Assessment/i.test(rowText))) continue;
				census.carriers++;
				var href = "";
				var as = row.querySelectorAll("a[href]");
				for (var i = 0; i < as.length; i++) {
					var h = as[i].getAttribute("href") || "";
					var m = /checkForLockPriorToView\('([^']+)'\)/.exec(h);
					if (m) {
						href = m[1];
						break;
					}
					if (!href && /(mds\.jsp|mdssection\.jsp)/.test(h)) href = h;
				}
				if (href) {
					census.anchors++;
					links.push({
						date: dateStr,
						href
					});
				}
			}
			links.sort(function(a, b) {
				return new Date(b.date) - new Date(a.date);
			});
			return {
				links,
				census
			};
		}
		var BIMS_TYPE_RE = /BIMS|Brief Interview|Mental Status|Cognitive|Social Service|MDS/i;
		function findBimsTypeIds(doc) {
			var sel = doc.querySelector("select[name=\"ESOLstdassessid\"]");
			if (!sel) return [];
			var found = [];
			var opts = sel.querySelectorAll("option");
			for (var i = 0; i < opts.length; i++) {
				var v = opts[i].getAttribute("value") || "";
				var label = (opts[i].textContent || "").replace(/\s+/g, " ").trim();
				if (!/^\d+$/.test(v)) continue;
				if (!BIMS_TYPE_RE.test(label)) continue;
				var vm = label.match(/V\s*(\d+)\s*(\(Retired\))?\s*$/i) || label.match(/V\s*(\d+)/i);
				found.push({
					id: v,
					retired: /retired/i.test(label),
					ver: vm ? parseInt(vm[1], 10) : 0,
					ord: i
				});
			}
			found.sort(function(a, b) {
				if (a.retired !== b.retired) return a.retired ? 1 : -1;
				if (a.ver !== b.ver) return b.ver - a.ver;
				return a.ord - b.ord;
			});
			return found.slice(0, 10).map(function(f) {
				return f.id;
			});
		}
		function allTypeIds(doc) {
			var sel = doc.querySelector("select[name=\"ESOLstdassessid\"]");
			if (!sel) return [];
			var out = [];
			var opts = sel.querySelectorAll("option");
			for (var i = 0; i < opts.length; i++) {
				var v = opts[i].getAttribute("value") || "";
				if (/^\d+$/.test(v)) out.push(v);
			}
			return out;
		}
		function mergeBimsPoint(G, point, strength) {
			if (!point || !(point.score >= 0 && point.score <= 15 || point.score === 99) || !point.date) return;
			var cur = G.packet.stops.bims;
			var inc = strength || G.strength || "copy";
			if (!cur || cur.status !== "landed" || !cur.series) {
				G.land("bims", {
					source: "Assessments",
					at: G.nowT(),
					strength: inc,
					facts: { latest: point.score + " on " + point.date },
					series: [point],
					summary: "BIMS " + point.score + " on " + point.date + " · 1 scored"
				});
				return;
			}
			var series = cur.series.slice();
			var seen = false;
			for (var i = 0; i < series.length; i++) if (series[i].date === point.date) {
				seen = true;
				break;
			}
			if (!seen) series.push(point);
			series.sort(function(a, b) {
				return new Date(b.date) - new Date(a.date);
			});
			series = series.slice(0, 24);
			var top = series[0];
			cur.series = series;
			cur.facts = { latest: top.score + " on " + top.date };
			cur.summary = "BIMS " + top.score + " on " + top.date + " · " + series.length + " scored";
			cur.at = G.nowT();
			delete cur.why;
			G.publish();
			G.saveStored();
		}
		function landHisNotes(entries, G) {
			var cur = G.packet.stops.hisnotes;
			var byDate = {};
			if (cur.status === "landed" && cur.list) cur.list.forEach(function(e) {
				byDate[e.date] = e;
			});
			entries.forEach(function(e) {
				var old = byDate[e.date];
				if (!old) {
					byDate[e.date] = e;
					return;
				}
				if (e.full && !old.full) byDate[e.date] = e;
				else if (e.full && old.full && (e.text || "").length > (old.text || "").length) byDate[e.date] = e;
			});
			var list = Object.keys(byDate).map(function(k) {
				return byDate[k];
			}).sort(function(a, b) {
				return new Date(b.date) - new Date(a.date);
			}).slice(0, 24);
			var fullN = list.filter(function(e) {
				return e.full;
			}).length;
			var rec = {
				source: "Assessments",
				at: G.nowT(),
				list,
				summary: "Your notes: " + list.length + " consults · " + fullN + " full text · latest " + (list[0] ? list[0].date : "-")
			};
			if (cur.status !== "landed") {
				G.land("hisnotes", rec);
				return;
			}
			var inc = G.strength || "copy";
			var RANK = {
				weak: 0,
				copy: 1,
				native: 2
			};
			if ((RANK[inc] || 0) < (RANK[cur.strength || "copy"] || 0)) return;
			rec.strength = inc;
			rec.status = "landed";
			G.packet.stops.hisnotes = rec;
			G.publish();
			G.saveStored();
		}
		function parseOpenedConsult(doc, G) {
			var tas = doc.querySelectorAll("textarea[name^=\"Cust_\"]");
			if (!tas.length) return;
			var parts = [];
			for (var i = 0; i < tas.length; i++) {
				var v = (tas[i].value || "").trim();
				if (v) parts.push(v);
			}
			if (!parts.length) return;
			var ed = doc.querySelector("input[name=\"ESOLediteddate\"]");
			var dm = ed && /^(\d{4})-(\d{2})-(\d{2})/.exec(ed.value || "");
			if (!dm) return;
			var date = parseInt(dm[2], 10) + "/" + parseInt(dm[3], 10) + "/" + dm[1];
			var radio = doc.querySelector("input[name=\"Cust_A_A\"]:checked");
			var evalNames = {
				"1": "New",
				"2": "Follow Up",
				"3": "Other"
			};
			var entry = {
				date,
				text: parts.join("\n").slice(0, 1500),
				full: true
			};
			if (radio && evalNames[radio.value]) entry.evalType = evalNames[radio.value];
			landHisNotes([entry], G);
		}
		function dropSelfUnlessAlone(summary) {
			var parts = String(summary || "").split(/,\s*/).filter(function(p) {
				return !!p.trim();
			});
			if (parts.length < 2) return summary;
			var rest = parts.filter(function(p) {
				return !/^self$/i.test(p.trim());
			});
			if (rest.length && rest.length !== parts.length) return rest.join(", ");
			return summary;
		}
		function landRelations(summary, G) {
			var cur = G.packet.stops.relations;
			summary = dropSelfUnlessAlone(G.norm(summary).slice(0, 300));
			if (/^relationships\b[\s:—–-]*$/i.test(summary)) return;
			if (cur.status !== "landed") {
				G.land("relations", {
					source: "Profile",
					at: G.nowT(),
					summary
				});
				G.feedRowTile(summary);
				return;
			}
			if (cur.summary !== summary) {
				var inc = G.strength || "copy";
				var RANK = {
					weak: 0,
					copy: 1,
					native: 2
				};
				if ((RANK[inc] || 0) < (RANK[cur.strength || "copy"] || 0)) return;
				G.packet.stops.relations = {
					status: "landed",
					source: "Profile",
					at: G.nowT(),
					summary,
					strength: inc
				};
				G.feedRowTile(summary);
				G.publish();
				G.saveStored();
			}
		}
		var RELS = [
			[
				/\bgirl[\s-]*friends?\b/,
				"girlfriend",
				"girlfriends"
			],
			[
				/\bwife\b/,
				"wife",
				"wives"
			],
			[
				/\bhusband\b/,
				"husband",
				"husbands"
			],
			[
				/\bspouse\b/,
				"spouse",
				"spouses"
			],
			[
				/\bfianc[e\u00e9]e?\b/,
				"fiancé",
				"fiancés"
			],
			[
				/\bdaughters?\b/,
				"daughter",
				"daughters"
			],
			[
				/\bsons?\b/,
				"son",
				"sons"
			],
			[
				/\bmother\b|\bmom\b/,
				"mother",
				"mothers"
			],
			[
				/\bfather\b|\bdad\b/,
				"father",
				"fathers"
			],
			[
				/\bsisters?\b/,
				"sister",
				"sisters"
			],
			[
				/\bbrothers?\b/,
				"brother",
				"brothers"
			],
			[
				/\bsiblings?\b/,
				"sibling",
				"siblings"
			],
			[
				/\bpartner\b/,
				"partner",
				"partners"
			],
			[
				/\bfriends?\b/,
				"friend",
				"friends"
			],
			[
				/\bneighbou?rs?\b/,
				"neighbor",
				"neighbors"
			],
			[
				/\broommates?\b/,
				"roommate",
				"roommates"
			],
			[
				/\bnieces?\b/,
				"niece",
				"nieces"
			],
			[
				/\bnephews?\b/,
				"nephew",
				"nephews"
			],
			[
				/\bcousins?\b/,
				"cousin",
				"cousins"
			],
			[
				/\bgranddaughters?\b/,
				"granddaughter",
				"granddaughters"
			],
			[
				/\bgrandsons?\b/,
				"grandson",
				"grandsons"
			],
			[
				/\baunt\b/,
				"aunt",
				"aunts"
			],
			[
				/\buncle\b/,
				"uncle",
				"uncles"
			],
			[
				/\bclergy\b|\bpastor\b|\bpriest\b|\bminister\b|\bimam\b|\brabbi\b/,
				"clergy",
				"clergy"
			],
			[
				/\bnurse\b/,
				"nurse",
				"nurses"
			],
			[
				/\bothers?\b/,
				"other",
				"others"
			],
			[
				/\bself\b/,
				"self",
				"self"
			]
		];
		RELS.forEach(function(r) {
			r[0] = new RegExp(r[0].source, "i");
		});
		var REL_NO_COUNT = { self: true };
		var REL_NAME_SKIP = {
			other: 1,
			nurse: 1,
			clergy: 1,
			self: 1
		};
		function relCanon(text) {
			for (var k = 0; k < RELS.length; k++) if (RELS[k][0].test(text)) return {
				c: RELS[k][1],
				p: RELS[k][2]
			};
			return null;
		}
		function relTidy(t) {
			return /^[A-Z]{2,4}$/.test(t) ? t : t.toLowerCase();
		}
		function relLabelFor(relText, nameText, G) {
			var re = /\(([^()]*[A-Za-z][^()]*)\)/g, m, unknown = null;
			while (m = re.exec(nameText)) {
				var t = G.norm(m[1]);
				if (!t) continue;
				var c = relCanon(t);
				if (c) return c;
				if (!unknown) unknown = {
					c: relTidy(t),
					p: null
				};
			}
			var r = G.norm(relText);
			if (r && !/^(n\/?a|none|-+)$/i.test(r)) return relCanon(r) || {
				c: relTidy(r),
				p: null
			};
			if (unknown) return unknown;
			for (var k = 0; k < RELS.length; k++) if (!REL_NAME_SKIP[RELS[k][1]] && RELS[k][0].test(nameText)) return {
				c: RELS[k][1],
				p: RELS[k][2]
			};
			return null;
		}
		function parseContacts(doc, G) {
			var tables = doc.querySelectorAll("table");
			for (var ti = 0; ti < tables.length; ti++) {
				var rows = tables[ti].querySelectorAll("tr");
				var hdr = -1, nameCol = -1, relCol = -1;
				for (var i = 0; i < rows.length; i++) {
					var cells = rows[i].querySelectorAll("td, th");
					var texts = [];
					for (var c0 = 0; c0 < cells.length; c0++) texts.push(ctxt(cells[c0]));
					var n = -1;
					for (var c1 = 0; c1 < texts.length; c1++) if (/^name\b/i.test(texts[c1])) {
						n = c1;
						break;
					}
					var hasCT = false, rc = -1;
					for (var c2 = 0; c2 < texts.length; c2++) {
						if (/^contact type\b/i.test(texts[c2])) hasCT = true;
						if (/^relation(ship)?\b/i.test(texts[c2])) rc = c2;
					}
					if (n > -1 && hasCT) {
						hdr = i;
						nameCol = n;
						relCol = rc;
						break;
					}
				}
				if (hdr === -1) continue;
				var counts = {}, order = [], plural = {};
				function add(lab) {
					if (!lab) return;
					if (!(lab.c in counts)) {
						counts[lab.c] = 0;
						order.push(lab.c);
						plural[lab.c] = lab.p;
					}
					counts[lab.c]++;
				}
				for (var j = hdr + 1; j < rows.length; j++) {
					var tds = rows[j].querySelectorAll("td");
					if (tds.length <= nameCol) continue;
					add(relLabelFor(relCol > -1 && tds[relCol] ? ctxt(tds[relCol]) : "", ctxt(tds[nameCol]), G));
				}
				if (!order.length) continue;
				return order.map(function(cn) {
					if (REL_NO_COUNT[cn]) return cn;
					var n2 = counts[cn];
					if (n2 < 2) return cn;
					return plural[cn] ? n2 + " " + plural[cn] : cn + " (" + n2 + ")";
				}).join(", ");
			}
			return "";
		}
		function parseProfile(doc, G) {
			var el = doc.querySelector("[data-fill-label=\"Relationships\"]");
			if (el && (el.tagName && el.tagName.toLowerCase() === "tm-tile" || el.closest && el.closest("tm-tile"))) el = null;
			var val = el ? el.getAttribute("data-fill-value") || G.txt(el) : "";
			if (!val || /^[—–-]+$/.test(G.norm(val)) || /^N\/?A$/i.test(G.norm(val))) {
				var cv = parseContacts(doc, G);
				if (cv) {
					landRelations(cv, G);
					return;
				}
			}
			if (!val) {
				var els = doc.querySelectorAll("div, span, td");
				for (var i = 0; i < els.length; i++) {
					if (els[i].closest && els[i].closest("tm-tile")) continue;
					if (/^Relationships$/i.test(G.txt(els[i])) && els[i].parentElement) {
						var pt = G.txt(els[i].parentElement);
						if (pt.length > 14) {
							val = pt.replace(/^Relationships\s*/i, "");
							break;
						}
					}
				}
			}
			if (val && !/^[—–-]+$/.test(G.norm(val)) && !/^N\/?A$/i.test(G.norm(val))) {
				landRelations(val, G);
				return;
			}
			if (el) return;
			if (!val && /Resident Profile/i.test(doc.title || "")) {
				var words = [
					"spouse",
					"wife",
					"husband",
					"daughter",
					"son",
					"sister",
					"brother",
					"mother",
					"father",
					"friend",
					"niece",
					"nephew",
					"partner",
					"guardian",
					"cousin",
					"grandson",
					"granddaughter",
					"aunt",
					"uncle"
				];
				var bodyT = doc.body && doc.body.textContent || "";
				var found = words.filter(function(wd) {
					return new RegExp("\\b" + wd + "\\b", "i").test(bodyT);
				});
				if (found.length) val = found.join(", ");
			}
			if (val && !/^[—–-]+$/.test(G.norm(val)) && !/^N\/?A$/i.test(G.norm(val))) {
				if (G.packet.stops.relations.status !== "landed") G.land("relations", {
					source: "Profile",
					at: G.nowT(),
					strength: "weak",
					summary: dropSelfUnlessAlone(G.norm(val).slice(0, 300))
				});
			}
		}
		function parseResults(doc, G) {
			var reports = [];
			var rows = doc.querySelectorAll("tr");
			for (var i = 0; i < rows.length; i++) {
				if (!rows[i].querySelector("[onclick*=\"viewReportPopup\"]")) continue;
				var cells = rows[i].cells ? Array.prototype.map.call(rows[i].cells, ctxt) : [];
				var date = firstDate(cells);
				var name = "";
				for (var k = 0; k < cells.length; k++) if (cells[k].length > name.length && !/Actions/i.test(cells[k])) name = cells[k];
				reports.push({
					name: name.slice(0, 80),
					date
				});
			}
			if (reports.length) G.land("labs", {
				source: "Results",
				at: G.nowT(),
				reports: reports.slice(0, 40),
				summary: reports.length + " reports · latest " + (reports[0].name || "") + " " + (reports[0].date || "")
			});
		}
		function parseLabReport(doc, G) {
			var tables = doc.querySelectorAll("table");
			var tbl = null;
			for (var i = 0; i < tables.length; i++) {
				var h = tables[i].querySelector("tr");
				if (h && /Ref\. Range/i.test(h.textContent || "") && /Flag/i.test(h.textContent || "")) {
					tbl = tables[i];
					break;
				}
			}
			if (!tbl) return;
			var date = "";
			var allText = doc.body && doc.body.textContent || "";
			var dm = /(?:Collected|Result Date|Report Date|Ordered)[^0-9]{0,20}(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(allText);
			if (dm) date = dm[1];
			if (!date) {
				var any = /(\d{1,2}\/\d{1,2}\/\d{4})/.exec(allText);
				if (any) date = any[1];
			}
			var analytes = [];
			var rows = tbl.querySelectorAll("tr");
			for (var r2 = 1; r2 < rows.length; r2++) {
				var cells = rows[r2].cells ? Array.prototype.map.call(rows[r2].cells, ctxt) : [];
				if (cells.length < 6) continue;
				var name = cells[1] || "";
				var value = cells[2] || "";
				if (!name || !value || !/^[\d.<>]+/.test(value)) continue;
				analytes.push({
					name: name.slice(0, 60),
					value,
					units: cells[3] || "",
					flag: (cells[5] || "").trim().slice(0, 3),
					date
				});
			}
			if (!analytes.length) return;
			var cur = G.packet.stops.labs;
			var rec = {
				source: "Results",
				at: G.nowT(),
				reports: cur.status === "landed" && cur.reports || [],
				analytes,
				summary: (cur.status === "landed" && cur.reports ? cur.reports.length + " reports · " : "") + analytes.length + " analytes from report " + date
			};
			if (cur.status !== "landed") {
				G.land("labs", rec);
				return;
			}
			var inc = G.strength || "copy";
			var RANK = {
				weak: 0,
				copy: 1,
				native: 2
			};
			if ((RANK[inc] || 0) < (RANK[cur.strength || "copy"] || 0)) return;
			rec.strength = inc;
			rec.status = "landed";
			G.packet.stops.labs = rec;
			G.publish();
			G.saveStored();
		}
		var PSYCH_MED_RE = /alprazolam|xanax|citalopram|celexa|escitalopram|lexapro|sertraline|zoloft|fluoxetine|prozac|paroxetine|paxil|fluvoxamine|venlafaxine|effexor|duloxetine|cymbalta|desvenlafaxine|bupropion|wellbutrin|mirtazapine|remeron|trazodone|nefazodone|vilazodone|vortioxetine|clozapine|clozaril|olanzapine|zyprexa|quetiapine|seroquel|risperidone|risperdal|paliperidone|invega|aripiprazole|abilify|ziprasidone|geodon|lurasidone|latuda|cariprazine|brexpiprazole|haloperidol|haldol|fluphenazine|chlorpromazine|perphenazine|loxapine|asenapine|iloperidone|divalproex|depakote|valproate|lamotrigine|lamictal|carbamazepine|tegretol|oxcarbazepine|lithium|gabapentin|neurontin|pregabalin|lyrica|topiramate|hydroxyzine|vistaril|buspirone|clonazepam|klonopin|lorazepam|ativan|diazepam|valium|temazepam|zolpidem|ambien|eszopiclone|zaleplon|ramelteon|suvorexant|doxepin|amitriptyline|nortriptyline|imipramine|clomipramine|methylphenidate|amphetamine|adderall|lisdexamfetamine|vyvanse|atomoxetine|guanfacine|clonidine|prazosin|propranolol|benztropine|donepezil|memantine|rivastigmine|galantamine|naltrexone|acamprosate|disulfiram|methadone|buprenorphine/i;
		function parseOrders(doc, G) {
			var active = [], psych = [];
			var rows = doc.querySelectorAll("tr");
			for (var i = 0; i < rows.length; i++) {
				var row = rows[i];
				if (!row.cells || row.cells.length < 5) continue;
				var t = Array.prototype.map.call(row.cells, ctxt);
				var statusIdx = t.findIndex(function(c) {
					return /^Active$/i.test(c);
				});
				if (statusIdx < 0) continue;
				var sigIdx = t.findIndex(function(c) {
					return /^(Give|Apply|Inject|Take|Instill|Inhale)\b/i.test(c);
				});
				var medCell = sigIdx > 0 ? t[sigIdx - 1] : "";
				var sig = sigIdx >= 0 ? t[sigIdx] : "";
				var start = "";
				for (var k = statusIdx + 1; k < t.length; k++) if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(t[k])) {
					start = t[k];
					break;
				}
				if (!medCell) continue;
				var rec = {
					name: medCell.slice(0, 90),
					sig: sig.slice(0, 140),
					start: start.slice(0, 16)
				};
				active.push(rec);
				if (PSYCH_MED_RE.test(medCell)) psych.push(rec);
			}
			if (active.length) G.land("orders", {
				source: "Orders",
				at: G.nowT(),
				active: active.length,
				psych: psych.slice(0, 30),
				summary: active.length + " active orders · " + psych.length + " psychiatric: " + psych.slice(0, 8).map(function(p) {
					return p.name;
				}).join("; ")
			});
		}
		window.__tmReaders = {
			parseAssessments,
			parseOpenedConsult,
			parseLabReport,
			parseProfile,
			parseResults,
			parseOrders,
			parseMdsHeader,
			parseBpBimsItems,
			cnrItemSum,
			findBimsViewLinks,
			findBimsTypeIds,
			allTypeIds,
			bimsPointsFromList,
			mergeBimsPoint
		};
	})();
	(function() {
		"use strict";
		var BTN_ID = "tmMoreLessBtn";
		var STYLE_ID = "tmTilesStyle";
		var shown = false;
		var TILE_CSS = "#residentHeaderExtended .residentHeaderPropsFlexGrid.tmTilesOn{display:flex!important;justify-content:flex-start!important;gap:12px!important;}#residentHeaderExtended .residentHeaderPropsFlexGrid.tmTilesOn .residentHeaderPropsFlexGridCol{flex:0 1 auto!important;max-width:660px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.05);padding:16px 18px;}";
		function targets() {
			var out = [];
			var cp = document.querySelector("#residentHeaderButtons [data-testid=\"care-profile\"]");
			if (cp) out.push(cp);
			var cq = document.getElementById("carequality-app");
			if (cq) out.push(cq);
			return out;
		}
		function tilesGrid() {
			var grids = document.querySelectorAll("#residentHeaderExtended .residentHeaderPropsFlexGrid");
			for (var i = 0; i < grids.length; i++) if (grids[i].querySelector(".residentHeaderPropsFlexGridCol")) return grids[i];
			return null;
		}
		function apply() {
			targets().forEach(function(el) {
				el.style.display = shown ? "" : "none";
			});
			var b = document.getElementById(BTN_ID);
			if (b) b.textContent = shown ? "Less" : "More";
			var st = document.getElementById(STYLE_ID);
			var grid = tilesGrid();
			if (!shown) {
				if (!st) {
					st = document.createElement("style");
					st.id = STYLE_ID;
					st.textContent = TILE_CSS;
					document.head.appendChild(st);
				}
				if (grid) grid.classList.add("tmTilesOn");
			} else {
				if (grid) grid.classList.remove("tmTilesOn");
				if (st) st.remove();
			}
		}
		function triggerS() {
			document.dispatchEvent(new KeyboardEvent("keydown", {
				key: "s",
				bubbles: true,
				cancelable: true
			}));
		}
		function triggerG() {
			queueHiddenTileFills();
			var badge = document.querySelector(".pcc-g-badge");
			if (badge) {
				badge.click();
				return;
			}
			try {
				localStorage.setItem("pccGrabSignal", String(Date.now()));
			} catch (e) {}
		}
		var ROW_ID = "tmCardsRow";
		function fmtAllergies(raw) {
			if (!raw) return "";
			var cleaned = raw.trim();
			if (/^no\s+known\s+(?:drug\s+)?allergies/i.test(cleaned) || /^nkda?/i.test(cleaned)) return "NKA";
			var list = cleaned.split(/[,;\/\n]+/);
			var out = [];
			for (var i = 0; i < list.length; i++) {
				var item = list[i].replace(/\s+/g, " ").trim();
				item = item.replace(/(?:Copy|Copied)$/i, "").trim();
				if (!item) continue;
				item = item.replace(/\bpen[ie]cill?in\b/gi, "PCN");
				out.push(item);
			}
			return out.join(", ");
		}
		function isCrownHeights() {
			try {
				var els = document.querySelectorAll("select, button, a, span, div, td");
				for (var i = 0; i < els.length; i++) {
					var tx = (els[i].textContent || "").trim();
					if (tx.length > 90 || tx.length < 6) continue;
					if (!/crown\s*heights/i.test(tx)) continue;
					var r = null;
					try {
						r = els[i].getBoundingClientRect();
					} catch (e) {}
					if (r && r.top >= -50 && r.top < 300) return true;
				}
			} catch (e) {}
			return false;
		}
		function roomBedNumber(withWing) {
			try {
				var txt = document.body && document.body.textContent ? document.body.textContent : "";
				var v = "";
				var m = txt.match(/\bLocation\s*:?\s*([^\n]*?)(?=\s*(?:Status|Code Status|Physician|DOB|Admission|Initial Admission|Discharge|Allergies|Special Instructions)\b|\n|$)/);
				if (m) v = m[1].replace(/\s+/g, " ").trim();
				if (!v) {
					var li = txt.search(/\bLocation\b/i);
					if (li !== -1) v = txt.substr(li, 40).replace(/\s+/g, " ").trim();
				}
				var rm = v.match(/\b(\d{2,4})\s*-?\s*([A-Za-z])?\b/);
				if (!rm) return "";
				var pre = "";
				if (withWing) {
					var tok = v.slice(0, rm.index).match(/([A-Za-z]+)\s*$/);
					if (tok && /^(east|west)$/i.test(tok[1])) pre = tok[1].charAt(0).toUpperCase();
					else if (tok && tok[1].length === 1 && /[ew]/i.test(tok[1])) pre = tok[1].toUpperCase();
				}
				return pre + rm[1] + (rm[2] ? rm[2].toUpperCase() : "");
			} catch (e) {
				return "";
			}
		}
		function selfData() {
			var out = {};
			try {
				var txt = document.body && document.body.textContent ? document.body.textContent : "";
				var m = txt.match(/\((\d{1,3})\/(Male|Female)\)/);
				if (m) out.ageSex = m[1] + (m[2] === "Male" ? "M" : "F");
				var room = roomBedNumber(isCrownHeights());
				if (room) out.room = room;
				var al = document.querySelector(".residentAllergies .residentDetailValue");
				if (al) {
					var f = fmtAllergies((al.textContent || "").trim());
					if (f) out.allergies = f;
				}
				var a1 = txt.match(/Admission\s*\(re-?entry\)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
				if (a1) {
					out.admission = a1[1] + " (re-entry)";
					out.admReentry = a1[1];
				}
				var a2 = txt.match(/Initial Admission Date[^0-9]*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
				if (a2) {
					out.admInitial = a2[1];
					if (!out.admission) out.admission = a2[1] + " (initial)";
				}
				var a3 = txt.match(/Discharge Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
				if (a3) out.admDischarge = a3[1];
			} catch (e) {}
			return out;
		}
		function cardData() {
			var out = selfData();
			var card = document.getElementById("copyInfoTable");
			if (!card) return out.ageSex || out.room || out.allergies || out.admission ? out : null;
			var cells = card.children;
			for (var i = 0; i < cells.length; i++) {
				var c = cells[i];
				if (!c.querySelector) continue;
				var lab = c.querySelector("span");
				if (!lab || !lab.firstChild) continue;
				var name = (lab.firstChild.textContent || "").trim().toLowerCase();
				var valSpan = c.querySelectorAll("span")[1];
				var val = valSpan ? (valSpan.textContent || "").trim() : "";
				var btn = c.querySelector(".pcc-fill-copy");
				var qv = btn ? btn.getAttribute("data-fill-value") : null;
				if (name.indexOf("age") === 0) {
					if (!out.ageSex) out.ageSex = qv || val;
				} else if (name.indexOf("room") === 0) {
					if (!out.room) out.room = val;
				} else if (name.indexOf("allergies") === 0) {
					if (!out.allergies) out.allergies = qv || val;
				} else if (name.indexOf("admission") === 0) {
					if (!out.admission) out.admission = val;
				}
			}
			return out.ageSex || out.room || out.allergies || out.admission ? out : null;
		}
		function weightValue() {
			var blocks = document.querySelectorAll(".vitalDetails");
			for (var i = 0; i < blocks.length; i++) {
				var b = blocks[i].querySelector("b");
				var v = blocks[i].querySelector(".vitalValue");
				if (b && v && /^weight$/i.test((b.textContent || "").trim())) {
					var m = (v.textContent || "").match(/([\d.]+)\s*lbs/i);
					if (m) return m[1] + " lbs";
				}
			}
			return null;
		}
		function weightFlagged() {
			var blocks = document.querySelectorAll(".vitalDetails");
			for (var i = 0; i < blocks.length; i++) {
				var b = blocks[i].querySelector("b");
				if (b && /^weight$/i.test((b.textContent || "").trim())) {
					var td = blocks[i].closest ? blocks[i].closest("td") : null;
					return !!(td && td.classList && td.classList.contains("vitalWithException"));
				}
			}
			return false;
		}
		function queueCopy(label, value) {
			try {
				if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value);
			} catch (err) {}
			var key = {
				"Age/Sex": "pccFillAgeSex",
				"Allergies": "pccFillAllergies",
				"Psych meds": "pccFillPsychMeds",
				"Relationships": "pccFillRelationships",
				"BIMS": "pccFillBims"
			}[label] || null;
			if (key) try {
				localStorage.setItem(key, JSON.stringify({
					value,
					ts: Date.now()
				}));
			} catch (err) {}
		}
		function hlTile(tl, withLabel) {
			if (tl.hasAttribute("data-tm-hl")) return;
			tl.setAttribute("data-tm-hl", "1");
			tl.setAttribute("data-tm-bg", tl.style.background || "");
			tl.setAttribute("data-tm-bd", tl.style.borderColor || "");
			tl.style.background = "#dbeafe";
			tl.style.borderColor = "#93c5fd";
			if (withLabel) {
				var ls = tl.querySelector("span");
				if (ls && !ls.getAttribute("data-tm-orig")) {
					ls.setAttribute("data-tm-orig", ls.textContent);
					ls.textContent = "Copied";
				}
			}
		}
		function hlAllTiles() {
			if (!document.getElementById("tmCardsRow")) return;
			var tiles = document.querySelectorAll("#tmCardsRow .pcc-fill-copy, #tmCardsRow [data-tm-copy=\"1\"], #tmCardsRow2 .pcc-fill-copy, #tmCardsRow2 [data-tm-copy=\"1\"]");
			for (var i = 0; i < tiles.length; i++) hlTile(tiles[i], true);
		}
		function hlRestoreAll() {
			var lit = document.querySelectorAll("#tmCardsRow [data-tm-hl=\"1\"], #tmCardsRow2 [data-tm-hl=\"1\"]");
			for (var i = 0; i < lit.length; i++) {
				var tl = lit[i];
				tl.removeAttribute("data-tm-hl");
				tl.style.background = tl.getAttribute("data-tm-bg") || "";
				tl.style.borderColor = tl.getAttribute("data-tm-bd") || "";
				tl.removeAttribute("data-tm-bg");
				tl.removeAttribute("data-tm-bd");
				var ls = tl.querySelector("span");
				if (ls && ls.getAttribute("data-tm-orig")) {
					ls.textContent = ls.getAttribute("data-tm-orig");
					ls.removeAttribute("data-tm-orig");
				}
			}
		}
		function flashLabel(ls, tl) {
			if (!ls.getAttribute("data-tm-orig")) ls.setAttribute("data-tm-orig", ls.textContent);
			ls.textContent = "Copied";
			setTimeout(function() {
				if (tl.hasAttribute("data-tm-hl")) return;
				var o = ls.getAttribute("data-tm-orig");
				if (o) {
					ls.textContent = o;
					ls.removeAttribute("data-tm-orig");
				}
			}, 1e3);
		}
		window.addEventListener("mouseup", hlRestoreAll);
		var SUM_ANCHORS = [
			"last",
			"14d",
			"admission",
			"total"
		];
		if (!window.__tmSumAnchor) window.__tmSumAnchor = "last";
		function sumAnchorLabel() {
			return window.__tmSummary && window.__tmSummary.anchors && window.__tmSummary.anchors[window.__tmSumAnchor] || "Since last visit";
		}
		function cycleSummaryAnchor(tileEl) {
			var i = SUM_ANCHORS.indexOf(window.__tmSumAnchor);
			window.__tmSumAnchor = SUM_ANCHORS[(i + 1) % SUM_ANCHORS.length];
			try {
				var t = window.__tmSummary && lastStops ? window.__tmSummary.text(lastStops, window.__tmSumAnchor) : "";
				if (tileEl) {
					tileEl.value = t;
					tileEl.chip = sumAnchorLabel();
					if (tileEl.opts) {
						if (tileEl.opts.click) tileEl.opts.click.value = t;
						if (tileEl.opts.fill) tileEl.opts.fill.value = t;
					}
					tileEl.setAttribute("data-fill-value", t);
				}
			} catch (e) {}
		}
		try {
			if (window.__tmCore) window.__tmCore.hooks = {
				queueCopy,
				hlTile,
				goWtsVitals,
				medsPanel,
				fireClick,
				flashLabel,
				cycleSummaryAnchor,
				action: function(name) {
					if (name === "yourwords" && window.__tmYourWordsApi) window.__tmYourWordsApi.open();
				}
			};
		} catch (e) {}
		function fireClick(el) {
			var W = el.ownerDocument && el.ownerDocument.defaultView || window;
			[
				"mousedown",
				"mouseup",
				"click"
			].forEach(function(type) {
				el.dispatchEvent(new W.MouseEvent(type, {
					bubbles: true,
					cancelable: true,
					view: W
				}));
			});
			try {
				el.click();
			} catch (e) {}
		}
		var ALL_TAB_LABELS = [
			"DASH",
			"PROFILE",
			"CENSUS",
			"MED DIAG",
			"PROBLEMS",
			"ALLERGIES",
			"IMMUN",
			"ORDERS",
			"WTS/VITALS",
			"RESULTS",
			"MDS",
			"FORMS",
			"THERAPY",
			"PROG NOTES",
			"CARE PLAN",
			"TASKS",
			"MISC",
			"ASSMNTS",
			"ASSESSMENTS"
		];
		function tabNorm(s) {
			return (s || "").replace(/\s+/g, " ").trim().toUpperCase();
		}
		function tabVisible(el) {
			return !!(el.getClientRects && el.getClientRects().length);
		}
		function tabDepth(el, doc) {
			var d = 0, p = el;
			while (p && p !== doc.body && d < 60) {
				d++;
				p = p.parentNode;
			}
			return d;
		}
		function findTabStrip(doc) {
			var cands = doc.querySelectorAll("div, table, ul, nav, section, td, tr, tbody, header");
			var best = null, bestDepth = -1;
			for (var i = 0; i < cands.length; i++) {
				var el = cands[i];
				if (!tabVisible(el)) continue;
				var tx = " " + tabNorm(el.textContent) + " ";
				var count = 0;
				for (var j = 0; j < ALL_TAB_LABELS.length; j++) if (tx.indexOf(" " + ALL_TAB_LABELS[j] + " ") !== -1) count++;
				if (count >= 8) {
					var d = tabDepth(el, doc);
					if (d > bestDepth) {
						bestDepth = d;
						best = el;
					}
				}
			}
			return best;
		}
		function findTabInDoc(doc, label) {
			var els = (findTabStrip(doc) || doc).querySelectorAll("a, button, td, li, span, div, th");
			var best = null, bestDepth = -1;
			for (var i = 0; i < els.length; i++) {
				var el = els[i];
				if (tabNorm(el.textContent) !== label) continue;
				if (!tabVisible(el)) continue;
				var d = tabDepth(el, doc);
				if (d > bestDepth) {
					bestDepth = d;
					best = el;
				}
			}
			return best;
		}
		function activateTab(el) {
			var W = el.ownerDocument && el.ownerDocument.defaultView || window;
			try {
				el.click();
			} catch (e) {}
			try {
				var init = {
					key: "Enter",
					code: "Enter",
					keyCode: 13,
					which: 13,
					bubbles: true,
					cancelable: true
				};
				el.dispatchEvent(new W.KeyboardEvent("keydown", init));
				el.dispatchEvent(new W.KeyboardEvent("keypress", init));
			} catch (e2) {}
			try {
				[
					"mousedown",
					"mouseup",
					"click"
				].forEach(function(type) {
					el.dispatchEvent(new W.MouseEvent(type, {
						bubbles: true,
						cancelable: true,
						view: W
					}));
				});
			} catch (e3) {}
		}
		function goWtsVitals() {
			try {
				localStorage.setItem("tmGoWts", String(Date.now()));
			} catch (e) {}
			var found = null;
			(function search(w) {
				if (found) return;
				try {
					found = findTabInDoc(w.document, "WTS/VITALS");
					if (found) return;
					for (var i = 0; i < w.frames.length && !found; i++) search(w.frames[i]);
				} catch (e) {}
			})(window.top || window);
			if (found) {
				activateTab(found);
				return true;
			}
			return false;
		}
		function medsPanel() {
			var docs = allDocs();
			for (var i = 0; i < docs.length; i++) {
				var box = docs[i].getElementById("medListBox");
				var btn = docs[i].getElementById("copyMedListBtn");
				if (box || btn) return {
					doc: docs[i],
					box,
					btn
				};
			}
			return null;
		}
		function medsDisplay() {
			var p = medsPanel();
			if (!p) return "";
			if (!p.box) return "- none";
			var divs = p.box.querySelectorAll("div");
			var lines = [];
			for (var i = 1; i < divs.length; i++) {
				var tx = (divs[i].textContent || "").trim();
				if (tx.indexOf("⚠ REVIEW") === 0) break;
				if (tx) lines.push(tx);
			}
			return lines.length ? lines.join("\n") : "- none";
		}
		function buildCards() {
			pullFromPacket();
			var bar = document.getElementById("residentHeaderButtons");
			if (!bar || !bar.parentNode) return;
			var d = cardData();
			if (d) {
				d.weight = weightValue();
				d.weightRed = weightFlagged();
				d.meds = medsDisplay() || feedMeds || "";
				var mp = medsPanel();
				d.medsFill = mp && mp.btn && mp.btn.hasAttribute("data-fill-value") ? mp.btn.getAttribute("data-fill-value") : feedMeds || null;
				d.bims = bimsValue();
				d.rel = relValue();
				d.dx = feedDx;
				d.beh = feedBeh;
				d.words = window.__tmYourWordsApi ? window.__tmYourWordsApi.get() : "";
				d.summary = window.__tmSummary && lastStops ? window.__tmSummary.text(lastStops, window.__tmSumAnchor) : "";
				d.stampRel = feedStampRel;
				d.stampBims = feedStampBims;
				d.stampMeds = feedStampMeds;
				d.stampDx = feedStampDx;
				d.stampBeh = feedStampBeh;
			}
			function medsOrderLines(lines) {
				var buckets = [], seen = {};
				lines.forEach(function(ln, i) {
					var m = / for (.+)$/.exec(ln);
					var ind = m ? m[1].replace(/\s+/g, " ").replace(/[.\s]+$/, "").toLowerCase() : "";
					var last = /seizure|epilep|parkinson/.test(ind || ln);
					var key = (last ? "L|" : "M|") + (ind || "#" + i);
					if (!seen[key]) {
						seen[key] = [];
						buckets.push(seen[key]);
					}
					seen[key].push({
						ln,
						last
					});
				});
				var main = buckets.filter(function(b) {
					return !b[0].last;
				});
				var lastB = buckets.filter(function(b) {
					return b[0].last;
				});
				var out = [];
				main.concat(lastB).forEach(function(b) {
					b.forEach(function(it) {
						out.push(it.ln);
					});
				});
				return out;
			}
			var medsLast = function(txt) {
				if (!txt || txt.indexOf("\n") === -1) return txt;
				return medsOrderLines(txt.split("\n")).join("\n");
			};
			if (d.meds) d.meds = medsLast(d.meds);
			if (d.medsFill) d.medsFill = medsLast(d.medsFill);
			document.getElementById(ROW_ID);
			if (!d) return;
			try {
				var chartVals = [
					d.ageSex || "",
					d.allergies || "",
					d.medsFill !== null && d.medsFill !== void 0 ? d.medsFill : d.meds || "",
					d.rel || ""
				].join("|");
				if (window.__tmChartLast !== chartVals || Date.now() - (window.__tmChartTs || 0) > 2e4) {
					window.__tmChartLast = chartVals;
					window.__tmChartTs = Date.now();
					localStorage.setItem("tmTileChart", JSON.stringify({
						ageSex: d.ageSex || null,
						allergies: d.allergies || null,
						facCH: isCrownHeightsHere(),
						facBedford: isBedfordHere(),
						meds: d.medsFill !== null && d.medsFill !== void 0 ? d.medsFill : d.meds || null,
						rel: d.rel || null,
						bims: d.bims || null,
						bimsPrev: (function() {
							try {
								var sr = lastStops && lastStops.bims && lastStops.bims.series;
								if (sr && sr[1]) {
									var q = new Date(sr[1].date);
									if (!isNaN(q.getTime())) return sr[1].score + " on " + (q.getMonth() + 1) + "/" + q.getDate() + "/" + String(q.getFullYear()).slice(2);
								}
							} catch (e) {}
							return null;
						})(),
						readmit: (function() {
							try {
								var bx = document.getElementById("tmReadmitBox");
								return !!(bx && bx.__mode === "alert");
							} catch (e) {
								return false;
							}
						})(),
						dx: d.dx || null,
						key: chartNumMatch() || null,
						ts: window.__tmChartTs
					}));
				}
			} catch (e) {}
			var tw = null;
			try {
				tw = window.__tmCore && window.__tmCore.warn ? window.__tmCore.warn() : JSON.parse(localStorage.getItem("tmTileWarn") || "null");
			} catch (e) {}
			if (tw && Date.now() - (tw.ts || 0) > 12e4) tw = null;
			if (tw) {
				var noteOpen = false;
				try {
					var no = window.__tmCore && window.__tmCore.noteOpen ? window.__tmCore.noteOpen() : JSON.parse(localStorage.getItem("tmNoteOpen") || "null");
					noteOpen = !!(no && no.ts && Date.now() - no.ts < 75e3);
				} catch (e) {}
				if (!noteOpen) tw = null;
			}
			if (tw && tw.key) {
				var myKey = chartNumMatch();
				if (myKey && tw.key !== myKey) tw = null;
			}
			var specs = [];
			function mkSpec(rowN, key, label, value, opts, chip, stamp) {
				specs.push({
					row: rowN,
					key,
					label,
					value: value || "",
					opts: opts || {},
					chip: chip || "",
					stamp: stamp || ""
				});
			}
			mkSpec(1, "admission", "Admission", "Re-entry|" + (d.admReentry || "—") + "\nInitial|" + (d.admInitial || "—") + "\nDischarge|" + (d.admDischarge || "—"), {
				band: 1,
				bandW: 160,
				pad: "6px 12px",
				size: 12.5,
				rows: true
			});
			mkSpec(1, "agesex", "Age / Sex", d.ageSex || "", {
				band: 1,
				bandW: 80,
				pad: "6px 12px",
				size: 15,
				warn: !!(tw && tw.age),
				click: {
					label: "Age/Sex",
					value: d.ageSex || ""
				},
				fill: {
					label: "Age/Sex",
					value: d.ageSex || ""
				}
			});
			mkSpec(1, "room", "Room", d.room || "", {
				band: 1,
				bandW: 76,
				pad: "6px 12px",
				size: 15
			});
			mkSpec(1, "allergies", "Allergies", d.allergies || "", {
				band: 1,
				bandW: 300,
				pad: "6px 12px",
				size: 13,
				natW: true,
				maxW: 300,
				weight: 600,
				color: "#a33327",
				fit: true,
				warn: !!(tw && tw.allergies),
				click: {
					label: "Allergies",
					value: d.allergies || ""
				},
				fill: {
					label: "Allergies",
					value: d.allergies || ""
				}
			});
			mkSpec(1, "weight", "Weight", d.weight || "", {
				band: 1,
				bandW: 100,
				pad: "6px 12px",
				size: 15,
				nav: true,
				nowrap: true,
				fit: true,
				color: d.weightRed ? "#a33327" : void 0
			});
			mkSpec(1, "bims", "BIMS", d.bims || "", {
				band: 1,
				bandW: 140,
				pad: "6px 12px",
				size: 14,
				natW: true,
				nowrap: true,
				fit: true,
				warn: !!(tw && tw.bims),
				click: {
					label: "BIMS",
					value: d.bims || ""
				},
				fill: {
					label: "BIMS",
					value: d.bims || ""
				}
			});
			mkSpec(1, "rel", "Relationships", d.rel || "", {
				band: 1,
				bandW: 196,
				pad: "6px 12px",
				size: 15,
				natW: true,
				maxW: 280,
				fit: true,
				warn: !!(tw && tw.rel),
				click: {
					label: "Relationships",
					value: d.rel || ""
				},
				fill: {
					label: "Relationships",
					value: d.rel || ""
				}
			});
			var medsChip = String(d.meds === "- none" ? 0 : d.meds ? d.meds.split("\n").length : 0);
			if (d.medsFill !== null && d.medsFill !== void 0) mkSpec(2, "meds", "Psych meds", d.meds || "", {
				cols: true,
				wide: true,
				multi: true,
				size: 13,
				weight: 600,
				maxw: "920px",
				warn: !!(tw && tw.meds),
				click: {
					label: "Psych meds",
					value: d.medsFill
				},
				fill: {
					label: "Psych meds",
					value: d.medsFill
				}
			}, medsChip, d.stampMeds);
			else mkSpec(2, "meds", "Psych meds", d.meds || "", {
				cols: true,
				wide: true,
				multi: true,
				size: 13,
				weight: 600,
				maxw: "920px",
				warn: !!(tw && tw.meds),
				delegate: "meds"
			}, medsChip, d.stampMeds);
			mkSpec(2, "summary", "Summary", d.summary || "", {
				full: true,
				multi: true,
				size: 13,
				weight: 600,
				anchorCycle: true,
				click: {
					label: "Summary",
					value: d.summary || ""
				},
				fill: {
					label: "Summary",
					value: d.summary || ""
				}
			}, sumAnchorLabel());
			mkSpec(2, "words", "Your words", d.words || "", {
				full: true,
				multi: true,
				size: 13,
				weight: 600,
				action: "yourwords"
			});
			mkSpec(2, "dx", "Diagnoses", d.dx || "", {
				full: true,
				multi: true,
				warn: !!(tw && tw.dx),
				size: 13,
				weight: 600,
				click: {
					label: "Diagnoses",
					value: d.dx || ""
				},
				fill: {
					label: "Diagnoses",
					value: d.dx || ""
				}
			}, null, d.stampDx);
			mkSpec(2, "beh", "Behaviors", d.beh || "", {
				full: true,
				multi: true,
				size: 13,
				weight: 600
			}, null, d.stampBeh);
			presentReadyTiles(specs);
			updateTiles(specs);
		}
		function specSig(sp) {
			try {
				return JSON.stringify([
					sp.label,
					sp.value,
					sp.chip,
					sp.stamp,
					sp.opts
				]);
			} catch (e) {
				return "";
			}
		}
		function applyTile(el, sp) {
			el.label = sp.label;
			el.value = sp.value || "";
			var o = sp.opts || {};
			if (el.getAttribute("data-tm-frozen")) {
				var cur = el.opts || {};
				if (cur.frozenW) o = Object.assign({}, o, {
					frozenW: cur.frozenW,
					frozenH: cur.frozenH
				});
			}
			el.opts = o;
			el.chip = sp.chip || "";
			el.stamp = sp.stamp || "";
			if (o.fill) {
				el.classList.add("pcc-fill-copy");
				el.setAttribute("data-g-badge", "1");
				el.setAttribute("data-fill-label", o.fill.label);
				el.setAttribute("data-fill-value", o.fill.value);
			} else {
				el.classList.remove("pcc-fill-copy");
				el.removeAttribute("data-fill-label");
				el.removeAttribute("data-fill-value");
			}
			if (o.delegate === "meds") el.setAttribute("data-tm-copy", "1");
			else el.removeAttribute("data-tm-copy");
		}
		function createTile(sp) {
			var el = document.createElement("tm-tile");
			el.style.display = "contents";
			applyTile(el, sp);
			__tileReg[sp.key] = {
				el,
				sig: specSig(sp)
			};
			return el;
		}
		var __tileReg = {};
		function settledNow() {
			try {
				return !!(window.__tmCore && window.__tmCore.settled && window.__tmCore.settled());
			} catch (e) {
				return false;
			}
		}
		function plantBand() {
			try {
				var bar = document.getElementById("residentHeaderButtons");
				if (!bar || !bar.parentNode) return;
				var row = document.getElementById(ROW_ID);
				var row2 = document.getElementById("tmCardsRow2");
				if (!row) {
					row = document.createElement("div");
					row.id = ROW_ID;
				}
				if (row.parentNode !== bar) bar.appendChild(row);
				row.style.cssText = "display:flex;gap:8px;flex-wrap:nowrap;margin:0;align-items:center;min-width:0;font-family:-apple-system,Helvetica,Arial,sans-serif;";
				bar.style.display = "flex";
				bar.style.alignItems = "center";
				bar.style.flexWrap = "nowrap";
				bar.style.gap = "10px";
				if (!row2) {
					row2 = document.createElement("div");
					row2.id = "tmCardsRow2";
				}
				if (isDashDoc()) {
					row2.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;margin:0 0 4px;align-items:flex-start;font-family:-apple-system,Helvetica,Arial,sans-serif;";
					var anchor = dashViewAnchor() || bar;
					if (row2.parentNode !== anchor.parentNode || anchor.nextSibling !== row2) anchor.parentNode.insertBefore(row2, anchor.nextSibling);
				} else {
					row2.style.cssText = "display:none;";
					if (row2.parentNode !== bar.parentNode || bar.nextSibling !== row2) bar.parentNode.insertBefore(row2, bar.nextSibling);
				}
			} catch (e) {}
		}
		function isDashDoc() {
			try {
				return /cp_residentdashboard/i.test(location.pathname || "");
			} catch (e) {
				return false;
			}
		}
		function dashViewAnchor() {
			var pv = document.getElementById("idPrintableViewBtn");
			if (!pv) {
				var cands = document.querySelectorAll("input, button, a");
				for (var i = 0; i < cands.length; i++) if ((cands[i].value || cands[i].textContent || "").trim() === "Printable View") {
					pv = cands[i];
					break;
				}
			}
			if (!pv || !pv.parentNode) return null;
			return (pv.closest ? pv.closest("table") : null) || pv.parentNode;
		}
		function queueHiddenTileFills() {
			if (isDashDoc()) return;
			[
				"meds",
				"summary",
				"dx"
			].forEach(function(key) {
				var reg = __tileReg[key];
				var el = reg && reg.el;
				if (!el) return;
				var label = el.getAttribute("data-fill-label");
				var value = el.getAttribute("data-fill-value");
				if (!label || !value || value === "N/A") return;
				queueCopy(label, value);
			});
		}
		var __bandSwept = false;
		var __settleObserved = false;
		var BAND_H = 72;
		var ROW_KEYS = {
			1: [
				"admission",
				"agesex",
				"room",
				"allergies",
				"weight",
				"bims",
				"rel"
			],
			2: [
				"meds",
				"summary",
				"words",
				"beh",
				"dx"
			]
		};
		function stopLanded(k) {
			var s = lastStops && lastStops[k];
			return !!(s && s.status === "landed");
		}
		var SUMMARY_INPUTS = [
			"hisnotes",
			"behaviors",
			"header",
			"bims",
			"diagnoses",
			"labs",
			"orders"
		];
		function stopResolved(k) {
			var s = lastStops && lastStops[k];
			return !!(s && s.status && s.status !== "not-loaded");
		}
		function medsPanelSettled() {
			var docs = allDocs();
			for (var i = 0; i < docs.length; i++) {
				var box = docs[i].getElementById("medListBox");
				if (box && box.hasAttribute("data-tm-meds-settled")) return true;
			}
			return false;
		}
		function tileReady(sp, fallback) {
			if (sp.key === "meds") {
				var p = medsPanel();
				if (p && p.box) return medsPanelSettled();
				if (stopLanded("dashmeds")) return true;
				if (lastStops && lastStops.header && lastStops.header.medsList) return true;
				return settledNow();
			}
			if (sp.key === "summary") {
				if (!settledNow()) return false;
				return SUMMARY_INPUTS.every(function(k) {
					return stopResolved(k);
				});
			}
			return settledNow() || fallback;
		}
		function keyOfTileEl(el) {
			var ks = Object.keys(__tileReg);
			for (var i = 0; i < ks.length; i++) if (__tileReg[ks[i]].el === el) return ks[i];
			return "";
		}
		function insertTileInOrder(host, el, sp) {
			var order = ROW_KEYS[sp.row] || [];
			var myIdx = order.indexOf(sp.key);
			var kids = host.querySelectorAll("tm-tile");
			for (var i = 0; i < kids.length; i++) if (order.indexOf(keyOfTileEl(kids[i])) > myIdx) {
				host.insertBefore(el, kids[i]);
				return;
			}
			host.appendChild(el);
		}
		function measureWrapCss(sp) {
			if (sp.key === "allergies") return "width:300px;";
			if (sp.key === "summary") return "width:max-content;max-width:640px;";
			if (sp.key === "words" || sp.key === "dx" || sp.key === "beh") return "width:max-content;max-width:720px;";
			if (sp.key === "meds") return "width:max-content;max-width:920px;";
			return "width:max-content;";
		}
		function measureTile(sp, done) {
			var host = document.createElement("div");
			host.setAttribute("data-tm-measure", "1");
			host.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden;" + measureWrapCss(sp);
			var t = document.createElement("tm-tile");
			t.style.display = "contents";
			t.label = sp.label;
			t.value = sp.value || "";
			t.opts = sp.opts || {};
			t.chip = sp.chip || "";
			t.stamp = sp.stamp || "";
			host.appendChild(t);
			document.body.appendChild(host);
			var finished = false, tries = 0;
			function finish(size) {
				if (finished) return;
				finished = true;
				try {
					host.remove();
				} catch (e) {}
				done(size);
			}
			function read() {
				try {
					fitAllergies(t);
				} catch (e) {}
				try {
					fitMeds(t);
				} catch (e) {}
				var card = t.querySelector("[data-tm-card]");
				var wpx = card ? card.offsetWidth || 0 : 0;
				var hpx = card ? card.offsetHeight || 0 : 0;
				if (wpx > 0 && hpx > 0) {
					finish([wpx, hpx]);
					return;
				}
				if (++tries > 12) {
					finish(null);
					return;
				}
				if (window.requestAnimationFrame) requestAnimationFrame(read);
				else setTimeout(read, 30);
			}
			if (t.updateComplete && t.updateComplete.then) t.updateComplete.then(function() {
				if (window.requestAnimationFrame) requestAnimationFrame(read);
				else setTimeout(read, 30);
			});
			else if (window.requestAnimationFrame) requestAnimationFrame(read);
			else setTimeout(read, 30);
		}
		var __tileMeasuring = {};
		var __lastSpecs = null;
		function presentReadyTiles(specs) {
			plantBand();
			var row = document.getElementById(ROW_ID);
			var row2 = document.getElementById("tmCardsRow2");
			if (!row || !row2) return;
			__lastSpecs = specs;
			if (!__bandSwept) {
				__bandSwept = true;
				[row, row2].forEach(function(r) {
					Array.from(r.querySelectorAll("tm-tile")).forEach(function(t) {
						t.remove();
					});
				});
			}
			var settled = settledNow();
			var fallback = settled && __settleObserved;
			if (settled) __settleObserved = true;
			specs.forEach(function(sp) {
				if (__tileReg[sp.key] || __tileMeasuring[sp.key]) return;
				if (!tileReady(sp, fallback)) return;
				if (sp.opts && sp.opts.band) {
					var bel = createTile(Object.assign({}, sp, { opts: Object.assign({}, sp.opts, {
						frozenW: sp.opts.bandW,
						frozenH: BAND_H
					}) }));
					bel.setAttribute("data-tm-frozen", "1");
					__tileReg[sp.key].sig = specSig(sp);
					var br1 = document.getElementById(ROW_ID);
					var br2 = document.getElementById("tmCardsRow2");
					if (br1 && br2) insertTileInOrder(br1, bel, sp);
					scheduleFit(sp.key, bel);
					return;
				}
				__tileMeasuring[sp.key] = true;
				measureTile(sp, function(size) {
					delete __tileMeasuring[sp.key];
					if (!size || __tileReg[sp.key]) return;
					var fresh = null;
					(__lastSpecs || []).forEach(function(s2) {
						if (s2.key === sp.key) fresh = s2;
					});
					if (fresh && specSig(fresh) !== specSig(sp)) {
						buildCards();
						return;
					}
					var el = createTile(Object.assign({}, sp, { opts: Object.assign({}, sp.opts, {
						frozenW: size[0],
						frozenH: size[1]
					}) }));
					el.setAttribute("data-tm-frozen", "1");
					__tileReg[sp.key].sig = specSig(sp);
					var r1 = document.getElementById(ROW_ID);
					var r2 = document.getElementById("tmCardsRow2");
					if (r1 && r2) insertTileInOrder(sp.row === 2 ? r2 : r1, el, sp);
					scheduleFit(sp.key, el);
				});
			});
		}
		function scheduleFit(key, el) {
			if (!el) return;
			var fitIt = function() {
				if (key === "allergies") fitAllergies(el);
				if (key === "meds") fitMeds(el);
			};
			if (window.requestAnimationFrame) requestAnimationFrame(function() {
				requestAnimationFrame(fitIt);
			});
			else setTimeout(fitIt, 60);
		}
		function updateTiles(specs) {
			specs.forEach(function(sp) {
				var reg = __tileReg[sp.key];
				if (!reg) return;
				var s = specSig(sp);
				if (s === reg.sig) return;
				reg.sig = s;
				applyTile(reg.el, sp);
			});
		}
		function findNameSeat() {
			var nameEl = null;
			var els = document.querySelectorAll("span, div, h1, h2, h3, td, a, b, strong");
			for (var i = 0; i < els.length; i++) {
				var tx = (els[i].textContent || "").replace(/\s+/g, " ").trim();
				if (tx.length > 70 || tx.length < 5) continue;
				if (/^clinical\s/i.test(tx)) continue;
				if (!/^[A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?\s*\(\s*[A-Za-z0-9 ]*\d[A-Za-z0-9 ]*\s*\)/.test(tx)) continue;
				var r = els[i].getBoundingClientRect();
				if (!r || r.width < 50) continue;
				nameEl = els[i];
				break;
			}
			if (!nameEl) {
				var nb = document.querySelector("#residentHeader .residentNameBadgeExpansion");
				if (nb && nb.parentNode) return {
					host: nb.parentNode,
					seat: nb
				};
				return null;
			}
			var seat = nameEl, hops = 0;
			while (seat.parentNode && hops < 4) {
				var p = seat.parentNode;
				if (!p || p.nodeType !== 1 || p.tagName === "BODY" || p.tagName === "HTML") break;
				var disp = "";
				try {
					disp = getComputedStyle(p).display;
				} catch (e3) {}
				if (disp === "flex" || disp === "inline-flex") break;
				seat = p;
				hops++;
			}
			while (seat && seat !== nameEl && (!seat.parentNode || seat.parentNode.nodeType !== 1)) seat = seat.firstElementChild || nameEl;
			var host = seat.parentNode;
			if (!host) {
				seat = nameEl;
				host = nameEl.parentNode;
			}
			if (!host) return null;
			return {
				host,
				seat
			};
		}
		var faceUrlCache = "";
		function addFaceSheetButton(bar, row) {
			try {
				if (location.pathname.indexOf("cp_residentdashboard") === -1) return;
				var ns = findNameSeat();
				if (!ns) return;
				var seat = ns.seat, host = ns.host;
				var btn = document.getElementById("tmFaceBtn");
				if (!btn) {
					btn = document.createElement("button");
					btn.type = "button";
					btn.id = "tmFaceBtn";
					btn.setAttribute("data-tooltip", "Face Sheet Report");
					btn.innerHTML = "<svg aria-hidden=\"true\" style=\"width:18px;height:18px;flex-shrink:0;margin-right:4px;\" viewBox=\"0 0 22 22\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12.833 1.83301L18.333 7.33301V18.333C18.333 19.3413 17.5083 20.167 16.5 20.167H5.49121C4.48288 20.167 3.66699 19.3413 3.66699 18.333L3.67578 3.66699C3.67578 2.65866 4.49167 1.83301 5.5 1.83301H12.833ZM7.33301 14.667V16.5H14.667V14.667H7.33301ZM7.33301 11V12.833H14.667V11H7.33301ZM11.917 8.25H16.958L11.917 3.20801V8.25Z\" fill=\"currentColor\"></path></svg>Face Sheet";
					btn.addEventListener("click", function() {
						openFaceSheet();
					});
				}
				btn.style.cssText = "position:static;background:linear-gradient(135deg,#fef9c3,#fde68a);border:2px solid #eab308;border-radius:6px;padding:4px 8px;box-shadow:0 2px 8px rgba(234,179,8,.4);font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",system-ui,sans-serif;font-size:15px;font-weight:600;color:#1c2430;cursor:pointer;display:inline-flex;align-items:center;gap:2px;margin-left:14px;vertical-align:middle;flex:none;align-self:center;";
				if (btn.previousElementSibling !== seat || btn.parentNode !== host) host.insertBefore(btn, seat.nextSibling);
			} catch (e) {}
		}
		function openFaceSheet() {
			if (faceUrlCache) {
				window.open(faceUrlCache, "_blank");
				return;
			}
			var a = document.querySelector("a[href*=\"cp_careclientprofile\"]");
			if (!a) return;
			fetch(a.href, { credentials: "include" }).then(function(r) {
				return r.text();
			}).then(function(html) {
				var m = /admissionRecord\.xhtml\?[^'"<\s]+/.exec(html.replace(/&amp;/g, "&"));
				if (!m) return;
				faceUrlCache = "/reporting/setup/runtime/" + m[0];
				window.open(faceUrlCache, "_blank");
			}).catch(function() {});
		}
		function fitAllergies(row) {
			var els = row.querySelectorAll("[data-fit=\"1\"]");
			for (var k = 0; k < els.length; k++) {
				var el = els[k];
				var size = 21;
				el.style.fontSize = size + "px";
				var guard = 0;
				while (guard < 14 && size > 10 && (el.scrollHeight > 56 || el.scrollWidth > el.clientWidth)) {
					size -= 1;
					el.style.fontSize = size + "px";
					guard++;
				}
			}
		}
		function fitMeds(row) {
			var boxes = row.querySelectorAll("[data-medsfit=\"1\"]");
			for (var b = 0; b < boxes.length; b++) {
				var lines = boxes[b].querySelectorAll(".tmMedLine");
				if (!lines.length) continue;
				var size = parseFloat(lines[0].style.fontSize) || 13;
				var guard = 0;
				var over = function() {
					for (var i = 0; i < lines.length; i++) if (lines[i].scrollWidth > lines[i].clientWidth + 2) return true;
					return false;
				};
				while (guard < 5 && size > 10 && over()) {
					size -= 1;
					for (var j = 0; j < lines.length; j++) lines[j].style.fontSize = size + "px";
					guard++;
				}
				if (over()) {
					for (var k = 0; k < lines.length; k++) if (lines[k].scrollWidth > lines[k].clientWidth + 2) lines[k].style.whiteSpace = "normal";
				}
			}
		}
		function allDocs() {
			var docs = [];
			(function walk(w) {
				try {
					docs.push(w.document);
				} catch (e) {
					return;
				}
				for (var i = 0; i < w.frames.length; i++) walk(w.frames[i]);
			})(window.top || window);
			return docs;
		}
		function crossValue(fn) {
			var docs = allDocs();
			for (var i = 0; i < docs.length; i++) {
				var v = fn(docs[i]);
				if (v) return v;
			}
			return "";
		}
		function bimsValue() {
			var bv = crossValue(function(doc) {
				var box = doc.getElementById("custom-bims-badge");
				if (!box) return "";
				var btn = box.querySelector(".pcc-fill-copy");
				if (btn && btn.getAttribute("data-fill-value")) return btn.getAttribute("data-fill-value");
				var vv = box.querySelector(".bims-value");
				return vv ? (vv.textContent || "").trim() : "";
			});
			if (bv && bv !== "N/A") return bv;
			if (feedBims) return feedBims;
			return scopedFeed("tmBimsFor:");
		}
		function scopedFeed(prefix) {
			try {
				var hrefs = "";
				var as = document.querySelectorAll("a[href]");
				for (var ai = 0; ai < as.length; ai++) hrefs += " " + (as[ai].getAttribute("href") || "");
				var bodyT = document.body && document.body.textContent || "";
				for (var i = 0; i < localStorage.length; i++) {
					var k = localStorage.key(i);
					if (!k || k.indexOf(prefix) !== 0) continue;
					var token = k.slice(prefix.length).replace(/^(chart|eid):/, "");
					if (!token || token.length < 4) continue;
					if (bodyT.indexOf(token) === -1 && hrefs.indexOf(token) === -1) continue;
					var f = JSON.parse(localStorage.getItem(k) || "null");
					if (f && f.value && Date.now() - (f.ts || 0) < 864e5) return String(f.value);
				}
			} catch (e) {}
			return "";
		}
		var feedRel = "", feedBims = "", feedMeds = "", feedDx = "", feedBeh = "";
		var feedStampRel = "", feedStampBims = "", feedStampMeds = "", feedStampDx = "", feedStampBeh = "";
		function stampOf(stop, homeRe) {
			if (!stop || stop.status !== "landed" || !stop.at) return "";
			if (stop.strength === "native" && homeRe.test(location.href)) return "";
			var m = /^(\d{1,2}):(\d{2})/.exec(stop.at);
			var t = stop.at;
			if (m) {
				var h = parseInt(m[1], 10);
				t = (h % 12 || 12) + ":" + m[2] + " " + (h >= 12 ? "PM" : "AM");
			}
			return (stop.strength === "weak" ? "weak read · " : "") + (stop.source || "Packet") + " · " + t;
		}
		var buildTimer = null, burstAt = 0;
		function scheduleBuild() {
			var now = Date.now();
			if (!burstAt) burstAt = now;
			if (buildTimer) clearTimeout(buildTimer);
			var wait = now - burstAt > 1200 ? 0 : 300;
			buildTimer = setTimeout(function() {
				buildTimer = null;
				burstAt = 0;
				buildCards();
				renderReadmitChip();
				renderHighChip();
			}, wait);
		}
		var lastStops = null;
		function pullFromPacket(fromSettleEvent) {
			try {
				if (!fromSettleEvent && window.__tmCore && window.__tmCore.settled && window.__tmCore.settled()) return;
				var n = document.getElementById("tmGatherPacket");
				try {
					var pk = JSON.parse(n && n.textContent || "{}");
					if (pk && pk.stops) lastStops = pk.stops;
				} catch (e) {}
				if (!n) return;
				var pkt = JSON.parse(n.textContent || "{}");
				if (!pkt.stops) return;
				var changed = false;
				var rel = pkt.stops.relations;
				if (rel && rel.status === "landed" && rel.summary && rel.summary !== feedRel) {
					feedRel = rel.summary;
					changed = true;
				}
				var b = pkt.stops.bims;
				if (b && b.status === "landed" && b.series && b.series[0]) {
					var d = new Date(b.series[0].date);
					if (!isNaN(d.getTime())) {
						var bl = b.series[0].score + " on " + (d.getMonth() + 1) + "/" + d.getDate() + "/" + String(d.getFullYear()).slice(2);
						if (bl !== feedBims) {
							feedBims = bl;
							changed = true;
						}
					}
				}
				var hd = pkt.stops.header;
				if (hd && hd.status === "landed" && hd.medsList) {
					if (hd.medsList !== feedMeds) {
						feedMeds = hd.medsList;
						changed = true;
					}
				}
				var dm = pkt.stops.dashmeds;
				if (!(hd && hd.medsList) && dm && dm.status === "landed" && dm.lines) {
					if (dm.lines !== feedMeds) {
						feedMeds = dm.lines;
						changed = true;
					}
				}
				var dxs = pkt.stops.diagnoses;
				if (dxs && dxs.status === "landed" && dxs.summary && dxs.summary !== feedDx) {
					feedDx = dxs.summary;
					changed = true;
				}
				var bhs = pkt.stops.behaviors;
				if (bhs && bhs.status === "landed" && bhs.summary && bhs.summary !== feedBeh) {
					feedBeh = bhs.summary;
					changed = true;
				}
				feedStampRel = stampOf(rel, /careclientprofile/);
				feedStampBims = stampOf(b, /cp_assessment|assessments/);
				feedStampMeds = stampOf(hd && hd.medsList ? hd : dm, /cp_residentdashboard|res_medications/);
				feedStampDx = stampOf(dxs, /progressnotes/);
				feedStampBeh = stampOf(bhs, /progressnotes/);
				if (changed) scheduleBuild();
			} catch (e) {}
		}
		document.addEventListener("tm-gather-update", function() {
			pullFromPacket(true);
		});
		pullFromPacket();
		setTimeout(pullFromPacket, 300);
		setTimeout(pullFromPacket, 900);
		setTimeout(pullFromPacket, 3500);
		document.addEventListener("tm-yourwords", function() {
			scheduleBuild();
		});
		document.addEventListener("tm-gather-feed", function(e) {
			var d = e && e.detail || {};
			var changed = false;
			if (d.rel && d.rel !== feedRel) {
				feedRel = d.rel;
				changed = true;
			}
			if (d.bims && d.bims !== feedBims) {
				feedBims = d.bims;
				changed = true;
			}
			if (d.meds && d.meds !== feedMeds) {
				feedMeds = d.meds;
				changed = true;
			}
			if (changed) scheduleBuild();
		});
		function relValue() {
			var v = crossValue(function(doc) {
				var btn = doc.getElementById("relCopyBtn");
				return btn ? btn.getAttribute("data-fill-value") || "" : "";
			});
			if (v) return v;
			if (feedRel) return feedRel;
			return scopedFeed("tmRelFor:");
		}
		function facilityNameHere(re) {
			try {
				var els = document.querySelectorAll("select, button, a, span, div, td");
				for (var i = 0; i < els.length; i++) {
					var tx = (els[i].textContent || "").trim();
					if (tx.length > 90 || tx.length < 6) continue;
					if (re.test(tx)) return true;
				}
			} catch (e) {}
			return false;
		}
		function isBedfordHere() {
			return facilityNameHere(/bedford/i);
		}
		function isCrownHeightsHere() {
			try {
				var els = document.querySelectorAll("select, button, a, span, div, td");
				for (var i = 0; i < els.length; i++) {
					var tx = (els[i].textContent || "").trim();
					if (tx.length > 90 || tx.length < 6) continue;
					if (/crown\s*heights/i.test(tx)) return true;
				}
			} catch (e) {}
			return false;
		}
		function chartNumMatch() {
			try {
				var _cd = window.__tmCore && window.__tmCore.chartDigits();
				if (_cd) return _cd;
			} catch (e) {}
			try {
				var els = document.querySelectorAll("span, div, h1, h2, h3, td, a, b, strong");
				for (var i = 0; i < els.length; i++) {
					var tx = (els[i].textContent || "").replace(/\s+/g, " ").trim();
					if (tx.length > 70 || tx.length < 5) continue;
					if (/^clinical\s/i.test(tx)) continue;
					var em = tx.match(/^[A-Za-z][A-Za-z'’.\-]+(?:\s+[A-Za-z][A-Za-z'’.\-]+)?\s*,\s*[A-Za-z][A-Za-z'’.\- ]+?\s*\(\s*[A-Za-z]{0,5}(\d{3,})\s*\)/);
					if (em) return em[1];
				}
			} catch (e) {}
			return "";
		}
		function plantChipSlots() {
			var g = document.getElementById("tmGBtn");
			if (!g || !g.parentNode) return;
			var strip = document.getElementById("tmFlagRow");
			if (!strip) {
				var nameBlock = document.querySelector("#residentHeader .residentNameBadgeExpansion");
				if (nameBlock && nameBlock.parentNode) {
					strip = document.createElement("div");
					strip.id = "tmFlagRow";
					strip.style.cssText = "display:flex;align-items:center;height:38px;overflow:hidden;";
					nameBlock.parentNode.insertBefore(strip, nameBlock.nextSibling);
				}
			}
			var barEl = document.getElementById("residentHeaderButtons");
			var rowEl = document.getElementById(ROW_ID);
			var afterRow = !!(barEl && rowEl && rowEl.parentNode === barEl);
			function plantSlot(el) {
				if (strip) {
					strip.appendChild(el);
					return;
				}
				if (afterRow) barEl.insertBefore(el, rowEl.nextSibling);
				else g.parentNode.insertBefore(el, g.nextSibling);
			}
			function homeSlot(id) {
				var el = document.getElementById(id);
				if (!el) {
					el = document.createElement("span");
					el.id = id;
					el.style.cssText = "display:inline-block;width:210px;height:38px;overflow:hidden;vertical-align:middle;flex:none;";
					plantSlot(el);
					return el;
				}
				if (strip && el.parentNode !== strip) strip.appendChild(el);
				return el;
			}
			var rsEl = homeSlot("tmReadmitSlot");
			var hsEl = homeSlot("tmHighSlot");
			if (strip && rsEl.parentNode === strip && hsEl.parentNode === strip && strip.children.length >= 2 && strip.children[0] === hsEl) strip.appendChild(hsEl);
		}
		function renderReadmitChip() {
			plantChipSlots();
			var g = document.getElementById("tmGBtn");
			var slot = document.getElementById("tmReadmitSlot");
			var old = slot ? slot.firstElementChild : null;
			var note = null;
			try {
				note = JSON.parse(localStorage.getItem("tmReadmitNote") || "null");
			} catch (e) {}
			var show = false;
			var chipMode = "";
			var verdict = null;
			try {
				verdict = JSON.parse(localStorage.getItem("tmReadmitVerdict") || "null");
			} catch (e) {}
			if (verdict && verdict.id && g) {
				var idm0 = chartNumMatch();
				var cur0 = (selfData().admission || "").replace(/\s*\((re-entry|initial)\)/i, "");
				if (idm0 && idm0 === verdict.id && cur0 === verdict.reentry) {
					show = verdict.verdict === "readmit" || verdict.verdict === "new";
					chipMode = verdict.verdict;
					note = null;
				}
			}
			if (note && note.id && g) {
				var idm = chartNumMatch();
				var curDate = (selfData().admission || "").replace(/\s*\((re-entry|initial)\)/i, "");
				show = !!idm && idm === note.id && curDate === note.date;
			}
			if (!show) {
				if (slot) slot.textContent = "";
				return;
			}
			if (old && old.getAttribute("data-mode") === chipMode) return;
			if (slot) slot.textContent = "";
			var chip = document.createElement("span");
			chip.id = "tmReadmitChip";
			chip.setAttribute("data-mode", chipMode);
			if (chipMode === "new") {
				chip.textContent = "NEW ADMISSION";
				chip.style.cssText = "display:inline-block;margin-left:10px;padding:5px 14px;background:#059669;color:#fff;border:3px solid #6ee7b7;border-radius:8px;font:800 15px -apple-system,Helvetica,Arial,sans-serif;letter-spacing:1px;vertical-align:middle;";
			} else {
				chip.textContent = "READMISSION";
				chip.style.cssText = "display:inline-block;margin-left:10px;padding:5px 14px;background:#ff1a1a;color:#fff;border:3px solid #ff8080;box-shadow:0 0 16px rgba(255,0,0,.6);border-radius:8px;font:800 15px -apple-system,Helvetica,Arial,sans-serif;letter-spacing:1px;vertical-align:middle;";
			}
			if (slot) slot.appendChild(chip);
			else if (g) g.parentNode.insertBefore(chip, g.nextSibling);
		}
		function renderHighChip() {
			plantChipSlots();
			var g = document.getElementById("tmGBtn");
			var slot = document.getElementById("tmHighSlot");
			var old = slot ? slot.firstElementChild : null;
			var note = null;
			try {
				note = JSON.parse(localStorage.getItem("tmHighFlags") || "null");
			} catch (e) {}
			var show = false;
			if (note && note.highs && note.highs.length && g) {
				var ifr = document.querySelectorAll("iframe");
				for (var i = 0; i < ifr.length; i++) {
					var mm = (ifr[i].getAttribute("src") || "").match(/ESOLclientid=(\d+)/);
					if (mm) {
						show = mm[1] === note.id;
						break;
					}
				}
			}
			if (!show) {
				if (slot) slot.textContent = "";
				return;
			}
			var txt = note.highs.length === 1 ? "HIGH: " + note.highs[0] : note.highs.length + " HIGH FLAGS";
			if (old) {
				if (old.textContent !== txt) old.textContent = txt;
				old.title = note.highs.join(" · ");
				return;
			}
			var chip = document.createElement("span");
			chip.id = "tmHighChip";
			chip.textContent = txt;
			chip.title = note.highs.join(" · ");
			chip.style.cssText = "display:inline-block;margin-left:10px;padding:5px 14px;background:#ff1a1a;color:#fff;border:3px solid #ff8080;box-shadow:0 0 16px rgba(255,0,0,.6);border-radius:8px;font:800 15px -apple-system,Helvetica,Arial,sans-serif;letter-spacing:1px;vertical-align:middle;box-sizing:border-box;max-width:186px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
			if (slot) slot.appendChild(chip);
			else if (g) {
				var anchorEl = document.getElementById("tmReadmitChip") || g;
				anchorEl.parentNode.insertBefore(chip, anchorEl.nextSibling);
			}
		}
		function run() {
			var bar = document.getElementById("residentHeaderButtons");
			if (!bar) return;
			plantBand();
			function firstLineHost() {
				var host = document.getElementById("tmFirstLineBtns");
				if (host) return host;
				host = document.createElement("span");
				host.id = "tmFirstLineBtns";
				host.style.cssText = "display:inline-flex;align-items:center;gap:8px;margin-left:12px;vertical-align:middle;flex:none;";
				var face = document.getElementById("tmFaceBtn");
				if (face && face.parentNode) {
					face.parentNode.insertBefore(host, face.nextSibling);
					return host;
				}
				var ns = findNameSeat();
				if (ns) {
					ns.host.insertBefore(host, ns.seat.nextSibling);
					return host;
				}
				return null;
			}
			function plantBtn(el) {
				var host = firstLineHost();
				if (host) {
					host.appendChild(el);
					return;
				}
				bar.appendChild(el);
			}
			[
				BTN_ID,
				"tmSBtn",
				"tmGBtn"
			].forEach(function(id) {
				var el = document.getElementById(id);
				if (el && el.parentNode && el.parentNode.id !== "tmFirstLineBtns") plantBtn(el);
			});
			if (!document.getElementById(BTN_ID)) {
				var b = document.createElement("button");
				b.type = "button";
				b.id = BTN_ID;
				b.className = "rh-header-btn";
				b.textContent = "More";
				b.addEventListener("click", function() {
					shown = !shown;
					apply();
				});
				plantBtn(b);
			}
			document.getElementById(BTN_ID);
			if (!document.getElementById("tmSBtn")) {
				var s = document.createElement("button");
				s.type = "button";
				s.id = "tmSBtn";
				s.className = "rh-header-btn";
				s.textContent = "S";
				s.title = "Copy name + room (same as the S key)";
				s.addEventListener("click", triggerS);
				plantBtn(s);
			}
			if (!document.getElementById("tmGBtn")) {
				var g = document.createElement("button");
				g.type = "button";
				g.id = "tmGBtn";
				g.className = "rh-header-btn";
				g.style.background = "#dbeafe";
				g.textContent = "G";
				g.addEventListener("mousedown", hlAllTiles);
				g.title = "Grab all — queue everything on screen (same as the G key)";
				g.addEventListener("click", triggerG);
				plantBtn(g);
			}
			plantChipSlots();
			if (!document.getElementById("tmGBtnStyle")) {
				var gst = document.createElement("style");
				gst.id = "tmGBtnStyle";
				gst.textContent = "#tmGBtn:active{background:#ffffff !important;}";
				(document.head || document.documentElement).appendChild(gst);
			}
			var stray;
			while (stray = document.getElementById("tmRelRow") || document.getElementById("tmBimsRow")) stray.remove();
			apply();
			buildCards();
			renderReadmitChip();
			renderHighChip();
		}
		var lastPing = 0;
		document.addEventListener("click", function() {
			var now = Date.now();
			if (now - lastPing < 1500) return;
			lastPing = now;
			try {
				localStorage.setItem("tmRowPing", String(now));
			} catch (e) {}
			scheduleBuild();
		}, true);
		window.addEventListener("storage", function(e) {
			if (e.key === "tmGoWts" && e.newValue) {
				var mine = findTabInDoc(document, "WTS/VITALS");
				if (mine) activateTab(mine);
				return;
			}
			if (e.key === "tmGPress") {
				if (e.newValue) hlAllTiles();
				else hlRestoreAll();
				return;
			}
			if (e.key === "tmTileWarn") {
				scheduleBuild();
				return;
			}
			if (e.key !== "tmRowPing" || !e.newValue) return;
			var ts = parseInt(e.newValue, 10);
			if (!ts || Date.now() - ts > 5e3) return;
			scheduleBuild();
		});
		function gKeyTyping(e) {
			var t = e.target;
			if (!t) return false;
			var tag = (t.tagName || "").toUpperCase();
			return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable === true;
		}
		document.addEventListener("keydown", function(e) {
			if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
			if ((e.key || "").toLowerCase() !== "g" || gKeyTyping(e)) return;
			try {
				localStorage.setItem("tmGPress", String(Date.now()));
			} catch (err) {}
			queueHiddenTileFills();
			hlAllTiles();
		});
		document.addEventListener("keyup", function(e) {
			if ((e.key || "").toLowerCase() !== "g") return;
			try {
				localStorage.setItem("tmGPress", "");
			} catch (err) {}
			hlRestoreAll();
		});
		plantBand();
		try {
			addFaceSheetButton(document.getElementById("residentHeaderButtons"), null);
		} catch (e) {}
		window.__tmCore.ladder(run, [
			300,
			900,
			1800,
			3e3,
			5e3,
			8e3,
			12e3,
			2e4
		]);
	})();
	(function() {
		"use strict";
		function allergySet(s) {
			return s.split(",").map(function(x) {
				var t = x.trim().toLowerCase();
				if (/penicillin/.test(t) || /\bpcn\b/.test(t)) return "pcn";
				return t;
			}).filter(Boolean).sort().join("|");
		}
		var MED_PAIRS = [
			["Risperdal", "risperidone"],
			["Seroquel", "quetiapine"],
			["Zyprexa", "olanzapine"],
			["Abilify", "aripiprazole"],
			["Invega", "paliperidone"],
			["Latuda", "lurasidone"],
			["Geodon", "ziprasidone"],
			["Haldol", "haloperidol"],
			["Prolixin", "fluphenazine"],
			["Thorazine", "chlorpromazine"],
			["Clozaril", "clozapine"],
			["Zoloft", "sertraline"],
			["Prozac", "fluoxetine"],
			["Paxil", "paroxetine"],
			["Celexa", "citalopram"],
			["Lexapro", "escitalopram"],
			["Effexor", "venlafaxine"],
			["Cymbalta", "duloxetine"],
			["Wellbutrin", "bupropion"],
			["Remeron", "mirtazapine"],
			["Trintellix", "vortioxetine"],
			["Viibryd", "vilazodone"],
			["Lamictal", "lamotrigine"],
			["Depakote", "divalproex"],
			["Depakote", "valproic acid"],
			["Depakote", "valproate"],
			["Tegretol", "carbamazepine"],
			["Trileptal", "oxcarbazepine"],
			["Topamax", "topiramate"],
			["Neurontin", "gabapentin"],
			["Lyrica", "pregabalin"],
			["Ativan", "lorazepam"],
			["Klonopin", "clonazepam"],
			["Xanax", "alprazolam"],
			["Valium", "diazepam"],
			["Restoril", "temazepam"],
			["Ambien", "zolpidem"],
			["Lunesta", "eszopiclone"],
			["Buspar", "buspirone"],
			["Vistaril", "hydroxyzine"],
			["Intuniv", "guanfacine"],
			["Strattera", "atomoxetine"],
			["Concerta", "methylphenidate"],
			["Vyvanse", "lisdexamfetamine"],
			["Adderall", "amphetamine"],
			["Cogentin", "benztropine"],
			["Aricept", "donepezil"],
			["Namenda", "memantine"],
			["Exelon", "rivastigmine"],
			["Razadyne", "galantamine"]
		];
		var MED_CANON = {};
		MED_PAIRS.forEach(function(p) {
			MED_CANON[p[0].toLowerCase()] = p[1];
			MED_CANON[p[1]] = p[1];
		});
		function canonMed(name) {
			var n = (name || "").toLowerCase().replace(/\b(hcl|hydrochloride|sodium|sulfate|fumarate|mesylate|succinate|phosphate)\b/g, "").replace(/\b(er|xr|sr|cr|odt|ir|la)\b/g, "").replace(/\s+/g, " ").trim();
			return MED_CANON[n] || n;
		}
		function parseMedLine(line) {
			var m = line.match(/^-\s+(.+?)\s+(\d[\s\S]*)$/);
			if (!m) return null;
			var name = m[1].trim(), rest = m[2].trim();
			if (name.indexOf(",") !== -1) return null;
			var spec = rest, ind = "";
			var fi = rest.lastIndexOf(" for ");
			if (fi !== -1) {
				spec = rest.slice(0, fi).trim();
				ind = rest.slice(fi + 5).trim();
			}
			if (!/\d\s*(mg|mcg|g|ml)\b/i.test(spec) && !/\b(QD|BID|TID|QID|QHS|QAM|QPM|PRN|daily|nightly|every)\b/i.test(spec)) return null;
			return {
				name,
				spec,
				ind,
				canon: canonMed(name)
			};
		}
		function normSpec(s) {
			return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
		}
		function medSectionLines(txt) {
			var lines = txt.split("\n"), hi = -1, ei = -1, i = 0;
			for (; i < lines.length; i++) if (/^\s*Psych meds\s*$/.test(lines[i])) {
				hi = i;
				break;
			}
			if (hi === -1) return null;
			for (i = hi + 1; i < lines.length; i++) if (/^\s*PLAN\b/.test(lines[i])) {
				ei = i;
				break;
			}
			if (ei === -1) ei = lines.length;
			return lines.slice(hi + 1, ei);
		}
		function tileVerdicts(txt, medsTxt, chart) {
			var v = {
				age: false,
				allergies: false,
				meds: false,
				rel: false,
				bims: false,
				dx: false
			};
			if (chart.ageSex) {
				var hm = txt.match(/^[ \t]*HPI[ \t]+(\d{1,3})[MF]\b/m);
				var qa = String(chart.ageSex).match(/\d{1,3}/);
				v.age = !hm || !qa || hm[1] !== qa[0];
			}
			if (chart.allergies && !chart.facCH && !chart.facBedford) {
				var am = txt.match(/^[ \t]*Allergies[ \t]*:?[ \t]*(.*)$/m);
				if (!am || !am[1].trim()) v.allergies = true;
				else {
					var nka = /^(NKA|NKDA|No[ \t]+known)/i;
					v.allergies = (nka.test(am[1].trim()) ? "" : allergySet(am[1].trim())) !== (nka.test(String(chart.allergies).trim()) ? "" : allergySet(String(chart.allergies)));
				}
			}
			if (chart.meds && !/^\s*(—|–|-)\s*$/.test(String(chart.meds))) {
				var secLines = null;
				if (medsTxt !== null && medsTxt !== void 0) secLines = medSectionLines(String(medsTxt));
				else secLines = medSectionLines(txt);
				var chartMap0 = {}, chartSeq0 = [];
				String(chart.meds).split("\n").forEach(function(l) {
					var p = parseMedLine(l);
					if (p) {
						chartMap0[p.canon] = normSpec(p.spec);
						chartSeq0.push(p.canon);
					}
				});
				var chartNone = /^\s*-\s*none\s*$/i.test(String(chart.meds).trim()) || chartSeq0.length === 0;
				if (!secLines) v.meds = true;
				else {
					var content = secLines.filter(function(l) {
						return l.trim() !== "";
					});
					var noteNone = content.length === 1 && /^\s*-\s*none\s*$/i.test(content[0].trim());
					if (!content.length) v.meds = true;
					else if (noteNone || chartNone) v.meds = noteNone !== chartNone;
					else {
						var noteMap = {}, chartMap = chartMap0, diff = false, k;
						var noteSeq = [], chartSeq = chartSeq0;
						content.forEach(function(l) {
							var p = parseMedLine(l);
							if (p) {
								noteMap[p.canon] = normSpec(p.spec);
								noteSeq.push(p.canon);
							}
						});
						for (k in chartMap) if (noteMap[k] !== chartMap[k]) {
							diff = true;
							break;
						}
						if (!diff) {
							for (k in noteMap) if (!(k in chartMap)) {
								diff = true;
								break;
							}
						}
						if (!diff && noteSeq.join("|") !== chartSeq.join("|")) diff = true;
						v.meds = diff;
					}
				}
			}
			var parseD = function(ds) {
				var p = String(ds).split("/");
				var y = +p[2];
				if (y < 100) y += 2e3;
				return new Date(y, +p[0] - 1, +p[1]);
			};
			var noteLatest = null, noteLatestVal = null;
			var blines = txt.split("\n");
			var bScoreRe = /^\s*\d{1,2}\s+on\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/;
			var bXxRe = /^\s*(?:\d{1,2}|xx)\s+on\s+xx\s*$/i;
			for (var bi = 0; bi < blines.length; bi++) {
				if (!/BIMS/i.test(blines[bi])) continue;
				var scanLines = [blines[bi]], bj = bi + 1;
				if (bj < blines.length) {
					scanLines.push(blines[bj]);
					bj++;
				}
				while (bj < blines.length && (bScoreRe.test(blines[bj]) || bXxRe.test(blines[bj]) || !blines[bj].trim())) {
					scanLines.push(blines[bj]);
					bj++;
				}
				var scan = scanLines.join("\n");
				var re2 = /(\d{1,2})\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/g, mm;
				while (mm = re2.exec(scan)) {
					var dt = parseD(mm[2]);
					if (!noteLatest || dt > noteLatest) {
						noteLatest = dt;
						noteLatestVal = +mm[1];
					}
				}
			}
			var sixAgo = new Date();
			sixAgo.setMonth(sixAgo.getMonth() - 6);
			var chartBimsVal = null, chartBimsDate = null;
			if (chart.bims) {
				var cbm = String(chart.bims).match(/^\s*(\d{1,2})\b/);
				if (cbm) chartBimsVal = +cbm[1];
				var cbd = String(chart.bims).match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
				if (cbd) chartBimsDate = parseD(cbd[1]);
			}
			var noteStop = noteLatestVal === 0 || noteLatestVal === 99;
			var chartStop = chartBimsVal === 0 || chartBimsVal === 99;
			if (noteLatest && chartBimsDate && noteLatest >= chartBimsDate) v.bims = false;
			else if (chartStop) v.bims = true;
			else if (noteStop && chartBimsVal === null) v.bims = false;
			else v.bims = !noteLatest || noteLatest < sixAgo;
			if (!v.bims && chart.readmit && chart.bims && chart.bimsPrev) {
				var cn = String(chart.bims).match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
				var cp = String(chart.bimsPrev).match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
				if (cn && cp) {
					var newest = parseD(cn[1]), prev = parseD(cp[1]);
					var winStart = new Date(newest);
					winStart.setMonth(winStart.getMonth() - 6);
					if (prev < winStart) v.bims = true;
				}
			}
			if (chart.dx) {
				var dsec = null;
				var dlines = txt.split("\n"), dhi = -1, dei = -1, di2 = 0;
				for (; di2 < dlines.length; di2++) if (/^\s*DX\s*$/.test(dlines[di2])) {
					dhi = di2;
					break;
				}
				if (dhi !== -1) {
					for (di2 = dhi + 1; di2 < dlines.length; di2++) if (/^\s*Psych meds\s*$/.test(dlines[di2])) {
						dei = di2;
						break;
					}
					if (dei === -1) dei = dlines.length;
					dsec = dlines.slice(dhi + 1, dei).join("\n");
				}
				var norm = function(x) {
					return String(x).toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
				};
				var noteDxNorm = dsec ? norm(dsec) : "";
				var missing = false;
				String(chart.dx).split("\n").forEach(function(ln) {
					var t = ln.trim();
					if (t.length < 4) return;
					var code = t.match(/\b[A-Z]\d{2}(?:\.\d{1,2})?\b/i);
					var namePart = norm(t.replace(/\b[A-Z]\d{2}(?:\.\d{1,2})?\b/i, ""));
					var carried = false;
					if (code && noteDxNorm.indexOf(code[0].toLowerCase()) !== -1) carried = true;
					if (!carried && namePart.length >= 10 && noteDxNorm.indexOf(namePart) !== -1) carried = true;
					if (!carried && norm(t).length >= 10 && noteDxNorm.indexOf(norm(t)) !== -1) carried = true;
					if (!carried) missing = true;
				});
				v.dx = missing;
			}
			if (chart.rel) {
				var cm = txt.match(/^[ \t]*Primary contact[ \t]+(.+)$/im);
				if (!cm || !cm[1].trim() || /^xx\b/i.test(cm[1].trim())) v.rel = true;
				else {
					var relSet = function(s) {
						var out = {};
						String(s).split(/[,;]|\s+and\s+/i).forEach(function(p) {
							var q = p.replace(/^[\s\-]+|[\s\-]+$/g, "").toLowerCase().replace(/\s+/g, " ");
							if (q) out[q] = 1;
						});
						return out;
					};
					var nSet = relSet(cm[1]), cSet = relSet(chart.rel), rDiff = false, rk;
					var cHasOther = false;
					for (rk in cSet) if (rk !== "self") {
						cHasOther = true;
						break;
					}
					if (cHasOther) {
						delete nSet.self;
						delete cSet.self;
					}
					for (rk in cSet) if (!nSet[rk]) {
						rDiff = true;
						break;
					}
					if (!rDiff) {
						for (rk in nSet) if (!cSet[rk]) {
							rDiff = true;
							break;
						}
					}
					v.rel = rDiff;
				}
			}
			return v;
		}
		var tileWarnPublished = false, tileWarnLast = "", tileWarnTs = 0, weHoldOpen = false, openChain = false;
		function clearTileWarn() {
			if (weHoldOpen) {
				try {
					localStorage.removeItem("tmNoteOpen");
				} catch (e) {}
				weHoldOpen = false;
			}
			if (!tileWarnPublished) return;
			tileWarnPublished = false;
			tileWarnLast = "";
			try {
				localStorage.removeItem("tmTileWarn");
			} catch (e) {}
		}
		function publishTileWarn() {
			var chart = null;
			try {
				chart = JSON.parse(localStorage.getItem("tmTileChart") || "null");
			} catch (e) {}
			if (chart && chart.ts && Date.now() - chart.ts > 9e4) chart = null;
			var field = findNoteField();
			if (!chart || !field) {
				clearTileWarn();
				return;
			}
			var txt = field.value || "";
			if (!looksLikeHisNote(txt)) {
				clearTileWarn();
				return;
			}
			var mf = findMedsField(field);
			var v = tileVerdicts(txt, mf ? mf.value || "" : null, chart);
			var evalEl = document.querySelector("input[name=\"Cust_A_A\"]:checked");
			if (!!!(evalEl && String(evalEl.value) === "1")) {
				v.rel = false;
				v.allergies = false;
				v.dx = false;
			}
			var s = JSON.stringify(v);
			if (s !== tileWarnLast || Date.now() - tileWarnTs > 2e4) {
				tileWarnLast = s;
				tileWarnTs = Date.now();
				try {
					localStorage.setItem("tmTileWarn", JSON.stringify({
						age: v.age,
						allergies: v.allergies,
						meds: v.meds,
						rel: v.rel,
						bims: v.bims,
						dx: v.dx,
						key: chart && chart.key || null,
						ts: tileWarnTs
					}));
				} catch (e) {}
			}
			tileWarnPublished = true;
			try {
				localStorage.setItem("tmNoteOpen", JSON.stringify({ ts: Date.now() }));
			} catch (e) {}
			weHoldOpen = true;
			if (!openChain) {
				openChain = true;
				setTimeout(function() {
					openChain = false;
					try {
						publishTileWarn();
					} catch (e) {}
				}, 15e3);
			}
		}
		window.addEventListener("pagehide", function() {
			try {
				clearTileWarn();
			} catch (e) {}
		});
		window.addEventListener("beforeunload", function() {
			try {
				clearTileWarn();
			} catch (e) {}
		});
		var tileInputLast = 0;
		document.addEventListener("input", function(e) {
			if (!e.isTrusted) return;
			var now = Date.now();
			if (now - tileInputLast < 700) return;
			tileInputLast = now;
			setTimeout(publishTileWarn, 50);
		}, true);
		function findNoteField() {
			var labels = document.querySelectorAll("td, th, div, span, label, b");
			for (var i = 0; i < labels.length; i++) {
				var t = (labels[i].textContent || "").replace(/\s+/g, " ").trim();
				if (/^1\.\s*Psychiatry\s+Consult:?$/i.test(t) || /^Psychiatry\s+Consult:?$/i.test(t) || /^\d\.\s*HPI\s*\//i.test(t) || /^HPI\s*\//i.test(t)) {
					var all = document.querySelectorAll("textarea");
					for (var j = 0; j < all.length; j++) if (labels[i].compareDocumentPosition(all[j]) & Node.DOCUMENT_POSITION_FOLLOWING) return all[j];
				}
			}
			var tas = document.querySelectorAll("textarea"), best = null, bestArea = 0;
			for (var k = 0; k < tas.length; k++) {
				var r = tas[k].getBoundingClientRect();
				var area = r.width * r.height;
				if (area > bestArea && r.width > 100 && r.height > 50) {
					bestArea = area;
					best = tas[k];
				}
			}
			return best;
		}
		function looksLikeHisNote(txt) {
			var anchors = 0;
			if (/\bHPI\b/.test(txt)) anchors++;
			if (/Medical Hx/.test(txt)) anchors++;
			if (/Psych meds/.test(txt)) anchors++;
			if (/Allergies/.test(txt)) anchors++;
			if (/Primary contact/.test(txt)) anchors++;
			if (/\bBIMS\b/.test(txt)) anchors++;
			return anchors >= 2;
		}
		function findMedsField(mainField) {
			var tas = document.querySelectorAll("textarea");
			for (var i = 0; i < tas.length; i++) {
				if (tas[i] === mainField) continue;
				var v = tas[i].value || "";
				if (/^\s*Psych meds\s*$/m.test(v) && (/^\s*PLAN\b/m.test(v) || /^\s*DX\b/m.test(v))) return tas[i];
			}
			return null;
		}
		var lastClickPub = 0;
		document.addEventListener("click", function(e) {
			if (!e.isTrusted) return;
			var now = Date.now();
			if (now - lastClickPub < 1e3) return;
			lastClickPub = now;
			setTimeout(publishTileWarn, 400);
		}, true);
		if (window.__tmCore && window.__tmCore.ladder) window.__tmCore.ladder(function() {
			publishTileWarn();
		}, [
			800,
			2e3,
			4e3,
			8e3,
			15e3
		]);
		else [
			800,
			2e3,
			4e3,
			8e3,
			15e3
		].forEach(function(ms) {
			setTimeout(publishTileWarn, ms);
		});
	})();
	(function() {
		"use strict";
		function store() {
			var w = window;
			try {
				if (window.top && window.top !== window) w = window.top;
			} catch (e) {}
			if (!w.__tmYourWords) w.__tmYourWords = {};
			return w.__tmYourWords;
		}
		function key() {
			try {
				var k = window.__tmCore && window.__tmCore.key() || "";
				if (!k && window.__tmGather && window.__tmGather.key) k = window.__tmGather.key() || "";
				return k;
			} catch (e) {
				return "";
			}
		}
		function get() {
			var k = key();
			return k ? store()[k] || "" : "";
		}
		function set(v) {
			var k = key();
			if (!k) return;
			store()[k] = v;
			document.dispatchEvent(new CustomEvent("tm-yourwords"));
			try {
				if (window.top && window.top !== window && window.top.document) window.top.document.dispatchEvent(new window.top.CustomEvent("tm-yourwords"));
			} catch (e) {}
		}
		var PANEL_ID = "tmYourWordsPanel";
		function close() {
			var p = document.getElementById(PANEL_ID);
			if (p) p.remove();
		}
		function open() {
			close();
			var p = document.createElement("div");
			p.id = PANEL_ID;
			p.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2147483000;width:min(520px,92vw);background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:12px 14px;box-shadow:0 12px 32px rgba(15,23,42,.22);font-family:-apple-system,Helvetica,Arial,sans-serif;";
			p.innerHTML = "<div style=\"display:flex;align-items:center;justify-content:space-between;\"><div style=\"font:700 13px -apple-system,Helvetica,Arial,sans-serif;color:#9a3412;\">Your words</div><button type=\"button\" id=\"tmYourWordsDone\" style=\"font:600 12px -apple-system,Helvetica,Arial,sans-serif;color:#9a3412;background:#ffedd5;border:1px solid #fdba74;border-radius:8px;padding:4px 12px;cursor:pointer;\">Done</button></div><textarea id=\"tmYourWordsText\" rows=\"4\" placeholder=\"Dictate or type here — verbatim, editable. Lives only in this tab; nothing is saved or sent.\" style=\"width:100%;box-sizing:border-box;margin-top:8px;border:1px solid #fdba74;border-radius:8px;padding:8px;font:400 14px -apple-system,Helvetica,Arial,sans-serif;color:#0f172a;background:#ffffff;resize:vertical;\"></textarea>";
			document.body.appendChild(p);
			var ta = p.querySelector("#tmYourWordsText");
			ta.value = get();
			ta.addEventListener("input", function() {
				set(ta.value);
			});
			ta.addEventListener("keydown", function(e) {
				if (e.key === "Escape") {
					e.stopPropagation();
					close();
				}
				e.stopPropagation();
			});
			p.querySelector("#tmYourWordsDone").addEventListener("click", close);
			try {
				ta.focus();
			} catch (e) {}
		}
		window.__tmYourWordsApi = {
			get,
			open,
			close
		};
	})();
	(function() {
		"use strict";
		function landed(stops, k) {
			var s = stops && stops[k];
			return s && s.status === "landed" ? s : null;
		}
		function dayMs(d) {
			var t = new Date(d);
			t.setHours(0, 0, 0, 0);
			return t.getTime();
		}
		function days(a, b) {
			return Math.round((dayMs(a) - dayMs(b)) / 864e5);
		}
		function fmtD(d) {
			var t = new Date(d);
			return t.getMonth() + 1 + "/" + t.getDate() + "/" + t.getFullYear();
		}
		function addDays(d, n) {
			return new Date(dayMs(d) + n * 864e5);
		}
		function events(stops) {
			var b = landed(stops, "behaviors");
			if (!b || !b.events || !b.events.length) return [];
			return b.events.filter(function(e) {
				return e && /^\d{4}-\d{2}-\d{2}$/.test(e.date);
			});
		}
		function anchors(stops) {
			var ev = events(stops);
			var h = landed(stops, "hisnotes");
			var lastNote = h && h.list && h.list[0] && h.list[0].date ? new Date(h.list[0].date) : null;
			if (lastNote && isNaN(lastNote)) lastNote = null;
			var adm = landed(stops, "header");
			var admDate = null;
			if (adm && adm.admission) {
				var ad = new Date(adm.admission);
				if (!isNaN(ad)) admDate = ad;
			}
			var earliest = null;
			ev.forEach(function(e) {
				if (!earliest || e.date < earliest) earliest = e.date;
			});
			var today = new Date();
			today.setHours(0, 0, 0, 0);
			return {
				last: function() {
					if (!lastNote) return this["14d"]();
					var span = Math.max(1, days(today, lastNote));
					return {
						kind: "trend",
						anchorDate: lastNote,
						anchorLabel: "your last visit (" + fmtD(lastNote) + ")",
						span,
						curStart: lastNote,
						curEnd: addDays(today, 1),
						prevStart: addDays(lastNote, -span),
						prevEnd: lastNote
					};
				},
				"14d": function() {
					var s = addDays(today, -14);
					return {
						kind: "trend",
						anchorDate: s,
						anchorLabel: "the past 14 days",
						span: 14,
						curStart: s,
						curEnd: addDays(today, 1),
						prevStart: addDays(s, -14),
						prevEnd: s
					};
				},
				admission: function() {
					if (admDate) return {
						kind: "course",
						anchorDate: admDate,
						anchorLabel: "admission (" + fmtD(admDate) + ")",
						curStart: admDate,
						curEnd: addDays(today, 1),
						earliestFellBack: false
					};
					if (earliest) {
						var ed = new Date(earliest + "T00:00:00");
						return {
							kind: "course",
							anchorDate: ed,
							anchorLabel: "the earliest notes on file (" + fmtD(ed) + ")",
							curStart: ed,
							curEnd: addDays(today, 1),
							earliestFellBack: true
						};
					}
					return null;
				},
				total: function() {
					var a = this.admission();
					if (a) {
						a.kind = "total";
						return a;
					}
					return null;
				}
			};
		}
		function resolveAnchor(stops, anchor) {
			return (anchors(stops)[anchor] || anchors(stops).last).call(anchors(stops));
		}
		function dayHas(ev, sigs, start, end) {
			var seen = {}, s0 = dayMs(start), s1 = dayMs(end);
			ev.forEach(function(e) {
				var t = dayMs(new Date(e.date + "T00:00:00"));
				if (t < s0 || t >= s1) return;
				if ((e.signals || []).some(function(s) {
					return sigs.indexOf(s) >= 0;
				})) seen[e.date] = 1;
			});
			return Object.keys(seen).length;
		}
		function medRefusalDays(ev, start, end) {
			var seen = {}, s0 = dayMs(start), s1 = dayMs(end);
			ev.forEach(function(e) {
				var t = dayMs(new Date(e.date + "T00:00:00"));
				if (t < s0 || t >= s1 || !e.medRefusal) return;
				seen[e.date] = 1;
			});
			return Object.keys(seen).length;
		}
		function windowEntries(ev, start, end) {
			var s0 = dayMs(start), s1 = dayMs(end), out = [];
			ev.forEach(function(e) {
				var t = dayMs(new Date(e.date + "T00:00:00"));
				if (t >= s0 && t < s1) out.push(e);
			});
			return out;
		}
		var SHORT = {
			"Refusals": "refusals",
			"Agitation": "agitation",
			"Sundowning": "sundowning",
			"Poor sleep": "poor sleep",
			"Falls": "falls",
			"Yelling / calling out": "yelling / calling out",
			"Wandering": "wandering",
			"Aggression": "aggression",
			"Tearfulness": "tearfulness",
			"Anxiety": "anxiety",
			"Poor appetite": "poor appetite",
			"Withdrawn": "withdrawal",
			"Non-compliance": "non-compliance"
		};
		var VERB = {
			"Refusals": "Refusals",
			"Agitation": "Agitation",
			"Sundowning": "Sundowning",
			"Poor sleep": "Poor sleep",
			"Falls": "Falls",
			"Yelling / calling out": "Yelling / calling out",
			"Wandering": "Wandering",
			"Aggression": "Aggression",
			"Tearfulness": "Tearfulness",
			"Anxiety": "Anxiety",
			"Poor appetite": "Poor appetite",
			"Withdrawn": "Withdrawal",
			"Non-compliance": "Non-compliance"
		};
		function freqQ(cur, span) {
			if (cur >= Math.max(5, span * .7)) return "near-daily";
			if (cur >= span * .4) return "several times a week";
			if (cur >= 2) return "occasionally";
			return "once";
		}
		function trendClause(sig, cur, prev, span, anchorLabel, prevHasData) {
			var v = VERB[sig] || sig, s = SHORT[sig] || sig.toLowerCase();
			if (!prevHasData) return v + ": " + cur + " day" + (cur === 1 ? "" : "s") + " in the window.";
			if (cur === 0 && prev > 0) return "No " + s + " since " + anchorLabel + " (previously " + prev + ")";
			if (cur > 0 && prev === 0) return v + " newly noted since " + anchorLabel + " (" + cur + " day" + (cur === 1 ? "" : "s") + ")";
			if (cur > prev && cur >= 2) return v + " more frequently since " + anchorLabel + " (" + freqQ(cur, span) + "; " + cur + " vs " + prev + " before)";
			if (cur < prev) return v + " less often since " + anchorLabel + " (" + cur + " vs " + prev + " before)";
			if (cur === prev && cur > 0) return v + " unchanged, still occurring (" + cur + " day" + (cur === 1 ? "" : "s") + ")";
			return "";
		}
		function medTrendClause(cur, prev, span, anchorLabel, prevHasData) {
			if (!prevHasData) return "Medication refusals: " + cur + " days in the window.";
			if (cur === 0 && prev > 0) return "No medication refusals since " + anchorLabel + " (previously " + prev + ")";
			if (cur > 0 && prev === 0) return "Refusing medication newly noted since " + anchorLabel + " (" + cur + " day" + (cur === 1 ? "" : "s") + ")";
			if (cur > prev && cur >= 2) return "Refusing medication more frequently over the past " + span + " days, " + freqQ(cur, span) + " (" + cur + " vs " + prev + " before)";
			if (cur < prev) return "Refusing medication less often since " + anchorLabel + " (" + cur + " vs " + prev + " before)";
			if (cur === prev && cur > 0) return "Medication refusals unchanged, still occurring (" + cur + " day" + (cur === 1 ? "" : "s") + ")";
			return "";
		}
		var DRUGS = [
			{
				re: /risperidone|risperdal|olanzapine|zyprexa|quetiapine|seroquel|aripiprazole|abilify|paliperidone|invega|haloperidol|haldol|lurasidone|latuda|cariprazine|vraylar|ziprasidone|geodon|fluphenazine|chlorpromazine|loxapine|asenapine|brexpiprazole|rexulti/i,
				cls: "antipsychotic"
			},
			{
				re: /sertraline|zoloft|fluoxetine|prozac|escitalopram|lexapro|citalopram|celexa|paroxetine|paxil|venlafaxine|effexor|duloxetine|cymbalta|desvenlafaxine|pristiq|mirtazapine|remeron|bupropion|wellbutrin|vortioxetine|trintellix/i,
				cls: "antidepressant"
			},
			{
				re: /zolpidem|ambien|eszopiclone|lunesta|temazepam|restoril|trazodone|desyrel|melatonin/i,
				cls: "hypnotic"
			},
			{
				re: /lithium|valproate|divalproex|depakote|carbamazepine|tegretol|lamotrigine|lamictal|oxcarbazepine|trileptal/i,
				cls: "mood stabilizer"
			},
			{
				re: /donepezil|aricept|rivastigmine|exelon|memantine|namenda|galantamine/i,
				cls: "dementia"
			}
		];
		var TARGETS = {
			antipsychotic: [
				"Agitation",
				"Aggression",
				"Yelling / calling out"
			],
			antidepressant: [
				"Anxiety",
				"Tearfulness",
				"Poor appetite",
				"Poor sleep"
			],
			hypnotic: ["Poor sleep", "Agitation"],
			"mood stabilizer": ["Agitation", "Aggression"],
			dementia: []
		};
		var ACT_RE = /\b(start(?:ed|ing)?|initiat(?:ed|ing)?|increase(?:d|s)?|rais(?:ed|e)|decrease(?:d|s)?|lower(?:ed|s)?|discontinu(?:ed|e|ing)|stop(?:ped|ping|s)?|switch(?:ed|ing)?|taper(?:ed|ing)?)\b/i;
		function actKind(w) {
			w = w.toLowerCase();
			if (/^start|^initiat/.test(w)) return "started";
			if (/^increase|^rais/.test(w)) return "increased";
			if (/^decrease|^lower/.test(w)) return "decreased";
			if (/^discontinu|^stop/.test(w)) return "stopped";
			if (/^switch/.test(w)) return "switched";
			if (/^taper/.test(w)) return "tapered";
			return "changed";
		}
		function mineMedChanges(stops) {
			var h = landed(stops, "hisnotes");
			if (!h || !h.list || !h.list.length) return {
				changes: [],
				noteDate: null
			};
			var latest = h.list[0];
			if (!latest.full || !latest.text) return {
				changes: [],
				noteDate: latest.date || null
			};
			var changes = [];
			latest.text.split(/(?<=[.!])\s*|\n/).forEach(function(sent) {
				if (changes.length >= 2) return;
				var am = ACT_RE.exec(sent);
				if (!am) return;
				for (var i = 0; i < DRUGS.length; i++) {
					var dm = DRUGS[i].re.exec(sent);
					if (!dm) continue;
					var doseM = /(\d+(?:\.\d+)?)\s*mg/i.exec(sent);
					changes.push({
						drug: dm[0].toLowerCase(),
						cls: DRUGS[i].cls,
						action: actKind(am[1]),
						dose: doseM ? doseM[1] + " mg" : "",
						when: sent.trim().slice(0, 120)
					});
					break;
				}
			});
			return {
				changes,
				noteDate: latest.date || null
			};
		}
		var TOL_RE = /\b(sedat\w+|dizz\w+|lightheaded|somnolen\w+|hypotension|orthostat\w+)\b/i;
		function medChangePart(stops, _win) {
			var mined = mineMedChanges(stops);
			if (!mined.changes.length || !mined.noteDate) return "";
			var changeDate = new Date(mined.noteDate);
			if (isNaN(changeDate)) return "";
			var ev = events(stops);
			var today = new Date();
			today.setHours(0, 0, 0, 0);
			var span = Math.max(1, days(today, changeDate));
			var postStart = addDays(changeDate, 1), postEnd = addDays(today, 1);
			var prevStart = addDays(changeDate, -span), prevEnd = changeDate;
			var post = windowEntries(ev, postStart, postEnd);
			var out = [];
			mined.changes.forEach(function(ch) {
				var head = "Since " + ch.drug + (ch.dose ? " " + ch.dose : "") + " was " + ch.action + " " + fmtD(changeDate);
				if (!post.length) {
					out.push(head + ": no progress notes since the change.");
					return;
				}
				var cls = [];
				(TARGETS[ch.cls] || []).forEach(function(sig) {
					var cur = dayHas(ev, [sig], postStart, postEnd), prev = dayHas(ev, [sig], prevStart, prevEnd);
					var s = SHORT[sig] || sig.toLowerCase(), verdict;
					if (cur === 0 && prev === 0) verdict = "not noted";
					else if (prev === 0) verdict = "new since the change";
					else if (cur === 0) verdict = "resolved since the change";
					else if (cur > prev && cur >= 2) verdict = "worse";
					else if (cur < prev) verdict = "improved";
					else verdict = "unchanged";
					cls.push(s + " " + verdict + " (" + cur + (prev || cur ? " vs " + prev + " before" : " days") + ")");
				});
				var tol = [];
				var tolSeen = {};
				post.forEach(function(e) {
					var m = TOL_RE.exec(e.text || "");
					if (m && !tolSeen[m[1].toLowerCase()]) {
						tolSeen[m[1].toLowerCase()] = 1;
						tol.push(m[1].toLowerCase());
					}
				});
				var falls = [];
				post.forEach(function(e) {
					if ((e.signals || []).indexOf("Falls") >= 0) falls.push(e.date);
				});
				var tail = cls.length ? cls.join(", ") : "no target-symptom notes";
				if (tol.length) tail += "; tolerability: " + tol.join(", ") + " noted";
				else tail += "; no side effects documented";
				if (falls.length) tail += "; fall" + (falls.length > 1 ? "s" : "") + " " + falls.slice(0, 2).map(function(d) {
					return "on " + d.slice(5).replace("-", "/");
				}).join(", ");
				out.push(head + ": " + tail + ".");
			});
			return out.join(" ");
		}
		var TREND_SIGNALS = [
			"Refusals",
			"Agitation",
			"Sundowning",
			"Poor sleep",
			"Falls",
			"Yelling / calling out",
			"Wandering",
			"Aggression",
			"Tearfulness",
			"Anxiety",
			"Poor appetite",
			"Withdrawn",
			"Non-compliance"
		];
		function trendPart(stops, win, _medDays) {
			var ev = events(stops);
			if (!ev.length) return "";
			var rows = [];
			TREND_SIGNALS.forEach(function(sig) {
				var cur = dayHas(ev, [sig], win.curStart, win.curEnd);
				var prev = win.kind === "trend" ? dayHas(ev, [sig], win.prevStart, win.prevEnd) : 0;
				if (!cur && !prev) return;
				rows.push({
					sig,
					cur,
					prev,
					delta: Math.abs(cur - prev)
				});
			});
			var mcur = medRefusalDays(ev, win.curStart, win.curEnd);
			var mprev = win.kind === "trend" ? medRefusalDays(ev, win.prevStart, win.prevEnd) : 0;
			var hasPrevData = win.kind === "trend" && windowEntries(ev, win.prevStart, win.prevEnd).length > 0;
			if (!rows.length && !mcur && !mprev) return "";
			rows.sort(function(a, b) {
				return b.delta - a.delta || b.cur - a.cur;
			});
			var lead = rows[0];
			var leadClause = mcur + mprev > 0 && (!lead || (mcur - mprev) * (mcur - mprev) >= lead.delta * lead.delta) ? medTrendClause(mcur, mprev, win.span, win.anchorLabel, hasPrevData) : trendClause(lead.sig, lead.cur, lead.prev, win.span, win.anchorLabel, hasPrevData);
			var rest = [];
			rows.forEach(function(r) {
				if (r === lead) return;
				if (!r.cur && !r.prev) return;
				if (r.delta === 0 && r.cur === 0) return;
				var c = trendClause(r.sig, r.cur, r.prev, win.span, win.anchorLabel, hasPrevData);
				if (c) rest.push(c.charAt(0).toLowerCase() + c.slice(1));
			});
			var out = leadClause;
			if (rest.length) out += ", with " + rest.slice(0, 2).join(" and ") + ".";
			else if (!/[.!]$/.test(out)) out += ".";
			if (!hasPrevData) out = "Since " + win.anchorLabel + ": " + out.charAt(0).toLowerCase() + out.slice(1);
			return out;
		}
		var FAMILIES = [
			{
				name: "Dementia",
				dx: /dementia|alzheimer|neurocognitive/i,
				sigs: [
					"Sundowning",
					"Wandering",
					"Withdrawn",
					"Agitation"
				]
			},
			{
				name: "Depression",
				dx: /depress|dysthymia/i,
				sigs: [
					"Anxiety",
					"Tearfulness",
					"Poor appetite",
					"Poor sleep"
				]
			},
			{
				name: "Psychosis",
				dx: /psychosis|psychotic|schizophrenia|bipolar/i,
				sigs: [
					"Aggression",
					"Yelling / calling out",
					"Agitation"
				]
			}
		];
		function bimsLine(stops) {
			var b = landed(stops, "bims");
			if (!b || !b.series || !b.series.length) return "";
			var s = b.series, cur = s[0];
			var t = "BIMS " + cur.score + " on " + (cur.date || "");
			if (s.length >= 2) {
				var d = cur.score - s[1].score;
				t += Math.abs(d) >= 2 ? d > 0 ? ", up from " + s[1].score : ", down from " + s[1].score + " on " + (s[1].date || "") : ", stable";
			}
			return t;
		}
		function problemPart(stops, win) {
			var ev = events(stops);
			var dx = landed(stops, "diagnoses");
			var dxText = dx && dx.summary ? dx.summary : "";
			var out = [];
			FAMILIES.forEach(function(f) {
				var changed = [];
				f.sigs.forEach(function(sig) {
					var cur = dayHas(ev, [sig], win.curStart, win.curEnd);
					var prev = win.kind === "trend" ? dayHas(ev, [sig], win.prevStart, win.prevEnd) : 0;
					if (cur !== prev || cur > 0) changed.push({
						sig,
						cur,
						prev
					});
				});
				var bims = f.name === "Dementia" ? bimsLine(stops) : "";
				if (!(changed.length > 0 || bims && /up from|down from/.test(bims))) return;
				var bits = [];
				if (bims) bits.push(bims);
				changed.slice(0, 3).forEach(function(c) {
					var s = SHORT[c.sig] || c.sig.toLowerCase();
					bits.push(c.cur > c.prev ? s + " up (" + c.cur + " vs " + c.prev + ")" : c.cur < c.prev ? s + " down (" + c.cur + " vs " + c.prev + ")" : s + " ongoing (" + c.cur + ")");
				});
				var name = f.name;
				if (!f.dx.test(dxText)) {}
				out.push(name + ": " + bits.join("; ") + ".");
			});
			return out.join(" ");
		}
		var MONITOR = [
			{
				med: /lithium/i,
				label: "lithium",
				checks: [
					{
						re: /lithium/i,
						name: "Lithium",
						level: true
					},
					{
						re: /creatinine/i,
						name: "creatinine"
					},
					{
						re: /tsh|thyroid/i,
						name: "TSH"
					}
				]
			},
			{
				med: /valpro|divalproex|depakote/i,
				label: "valproate",
				checks: [
					{
						re: /valpro/i,
						name: "Valproic acid",
						level: true
					},
					{
						re: /\balt\b|alanine/i,
						name: "ALT"
					},
					{
						re: /\bast\b|aspartate/i,
						name: "AST"
					},
					{
						re: /platelet/i,
						name: "platelets"
					}
				]
			},
			{
				med: /carbamazepine|tegretol/i,
				label: "carbamazepine",
				checks: [
					{
						re: /carbamazepine/i,
						name: "Carbamazepine",
						level: true
					},
					{
						re: /leukocytes|\bwbc\b/i,
						name: "WBC"
					},
					{
						re: /sodium/i,
						name: "sodium"
					}
				]
			},
			{
				med: /clozapine|clozaril/i,
				label: "clozapine",
				checks: [{
					re: /neutrophil|\banc\b/i,
					name: "ANC",
					level: true
				}, {
					re: /leukocytes|\bwbc\b/i,
					name: "WBC"
				}]
			}
		];
		function shortName(n) {
			var s = String(n || "");
			var i = s.indexOf(":");
			if (i >= 0) s = s.slice(i + 1);
			s = s.replace(/\s+LOINC.*$/i, "").replace(/\s+Lab Test.*$/i, "");
			return s.trim().slice(0, 26);
		}
		function labsPart(stops) {
			var l = landed(stops, "labs");
			if (!l || !l.analytes || !l.analytes.length) return "";
			var parts = [];
			var abn = l.analytes.filter(function(a) {
				return /h|l|\*/i.test(a.flag || "");
			});
			if (abn.length) parts.push("Abnormal: " + abn.slice(0, 4).map(function(a) {
				return shortName(a.name) + " " + a.value + " (" + a.flag + (a.date ? ", " + a.date : "") + ")";
			}).join(", ") + ".");
			var o = landed(stops, "orders");
			var medNames = o && o.psych ? o.psych.map(function(p) {
				return p.name || "";
			}).join(" ") : "";
			var today = new Date();
			MONITOR.forEach(function(m) {
				if (!m.med.test(medNames)) return;
				m.checks.forEach(function(c) {
					var hit = l.analytes.find(function(a) {
						return c.re.test(a.name);
					});
					if (hit && c.level) {
						var stale = hit.date && days(today, new Date(hit.date)) > 365;
						parts.push(c.name + " level " + hit.value + (hit.date ? " (" + hit.date + ")" : "") + (stale ? " - over a year old" : "") + ".");
					} else if (!hit && c.level) parts.push("No " + c.name.toLowerCase() + " level among the labs read (" + m.label + ").");
				});
			});
			if (!parts.length) return "Labs: nothing abnormal flagged.";
			return "Labs: " + parts.join(" ");
		}
		var AP_RE = /risperidone|risperdal|olanzapine|zyprexa|quetiapine|seroquel|aripiprazole|abilify|paliperidone|invega|haloperidol|haldol|lurasidone|latuda|cariprazine|vraylar|ziprasidone|geodon|fluphenazine|chlorpromazine|loxapine|asenapine|brexpiprazole|rexulti/i;
		function gdrPart(stops) {
			var o = landed(stops, "orders");
			if (!o || !o.psych) return "";
			var aps = o.psych.filter(function(p) {
				return AP_RE.test(p.name || "") && p.start;
			});
			if (!aps.length) return "";
			aps.sort(function(a, b) {
				return new Date(a.start) - new Date(b.start);
			});
			var ap = aps[0];
			var name = String(ap.name).split(/\s+/)[0];
			var months = Math.max(0, Math.round(days(new Date(), new Date(ap.start)) / 30.4));
			var taper = "";
			var h = landed(stops, "hisnotes");
			if (h && h.list) {
				var hit = h.list.find(function(e) {
					if (!e.full || !e.text) return false;
					var last = e.text.replace(/\s+$/, "").split("\n").pop() || "";
					return /gdr|taper|dose reduction|reduc\w+ (the )?dose/i.test(last) || /\bgdr\b/i.test(e.text);
				});
				if (hit) taper = "taper discussed " + hit.date;
			}
			return "GDR: " + name + " since " + ap.start + " (" + months + " mo), " + (taper || "no taper mentioned in your notes") + ".";
		}
		function safetyPart(stops, win) {
			var ev = events(stops);
			if (!windowEntries(ev, win.curStart, win.curEnd).length) return "";
			var out = [];
			if (!dayHas(ev, ["Falls"], win.curStart, win.curEnd)) out.push("no falls");
			if (!dayHas(ev, ["Aggression"], win.curStart, win.curEnd)) out.push("no aggression");
			return out.length ? out.join(", ").charAt(0).toUpperCase() + out.join(", ").slice(1) + "." : "";
		}
		function planPart(stops) {
			var h = landed(stops, "hisnotes");
			if (!h || !h.list || !h.list.length) return "";
			var latest = h.list[0];
			if (!latest.full || !latest.text) return "";
			var fu = /\bf\/(?:o|up)\s+([0-9][^\n.]{0,24})/i.exec(latest.text);
			return fu ? "Plan from your last note: f/o " + fu[1].trim() + "." : "";
		}
		var ANCHOR_LABELS = {
			last: "Since last visit",
			"14d": "Last 14 days",
			admission: "Since admission",
			total: "Total summary"
		};
		function text(stops, anchor) {
			if (!stops) return "";
			var win = resolveAnchor(stops, anchor || "last");
			if (!win) return "";
			var parts = [];
			if (win.kind === "total") {
				var h = landed(stops, "hisnotes");
				if (h && h.list && h.list.length) parts.push("Your notes: " + h.list.length + " since " + h.list[h.list.length - 1].date + ".");
			}
			parts.push(medChangePart(stops, win));
			parts.push(trendPart(stops, win));
			parts.push(problemPart(stops, win));
			parts.push(labsPart(stops));
			parts.push(gdrPart(stops));
			parts.push(safetyPart(stops, win));
			parts.push(planPart(stops));
			var cap = win.kind === "total" ? 1500 : 900;
			return parts.filter(function(s) {
				return !!s;
			}).join(" ").slice(0, cap);
		}
		window.__tmSummary = {
			text,
			anchors: ANCHOR_LABELS
		};
	})();
})();
