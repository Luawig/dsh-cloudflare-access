window.__ModuleLoader__.load({ id: "dsh-cloudflare-access", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var inject = ["connection"];
function apply(ctx) {
  const connection = ctx.get("connection") ?? ctx.connection;
  const original = connection.isLoopback;
  Object.defineProperty(connection, "isLoopback", {
    configurable: true,
    enumerable: true,
    get: () => true
  });
  ctx.effect(() => () => {
    Object.defineProperty(connection, "isLoopback", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: original
    });
  }, "dsh-cloudflare-access: restore connection.isLoopback");
}
return module.exports; } });
