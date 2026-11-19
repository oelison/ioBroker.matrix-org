"use strict";

const { assert } = require("assertthat");
const fs = require("node:fs");
const path = require("node:path");

const { COMMANDS, HELP } = require("../lib/help.js");

/**
 * The commands onMessage() of main.js answers
 *
 * @returns {string[]} command names
 */
function commandsOfMain() {
    const source = fs.readFileSync(path.join(__dirname, "../main.js"), "utf8");
    const start = source.indexOf("onMessage(obj) {");
    assert.that(start > 0).is.true();
    return [...new Set([...source.slice(start).matchAll(/obj\.command === '([^']+)'/g)].map(m => m[1]))];
}

suite("help", () => {
    test("lists exactly the commands onMessage answers, each once", done => {
        const names = COMMANDS.map(c => c.command);
        assert.that(new Set(names).size).is.equalTo(names.length);
        assert.that([...names].sort()).is.equalTo(commandsOfMain().sort());
        done();
    });
    test("marks only help as read-only", done => {
        for (const { command, write } of COMMANDS) {
            assert.that(write).is.equalTo(command !== "help");
        }
        done();
    });
    test("names every command for an agent", done => {
        for (const { command } of COMMANDS.filter(c => c.command !== "help")) {
            assert.that(HELP).is.containing(`- ${command}`);
        }
        assert.that(HELP).is.containing("sendTo matrix-org.0");
        assert.that(HELP).is.containing("How to talk to the user:");
        done();
    });
    test("keeps the lines short", done => {
        for (const line of HELP.split("\n")) {
            assert.that(line.length <= 120).is.true();
        }
        done();
    });
});
