"use strict";

const Os = require("os");

const helper = {};

helper.isWindows = function()
{
    return Os.platform() === "win32";
};

module.exports = helper;