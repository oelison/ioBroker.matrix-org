"use strict";

const {assert} = require("assertthat");
const { types } = require("util");

const helper = require("../lib/helper.js");

suite("helper", () => {
    test("isWindows", done => {
        const detector = helper.isWindows();
        assert.that(detector).is.ofType("boolean");
        done();
    });
});
