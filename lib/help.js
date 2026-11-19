'use strict';

/*
 * The answer of the command "help": what the instance answers, written for AI agents (e.g. ioBroker.pi-agent, or the
 * MCP server with "send_to") and script authors. Keep it in sync with onMessage() in main.js and the README.
 */

/** The commands onMessage() answers; write = the command has an effect (sends a message) */
export const COMMANDS = [
    { command: 'help', write: false },
    { command: 'send', write: true },
];

export const HELP = `ioBroker.matrix-org: a bot user that sends messages, pictures and files into one Matrix room
(the room of the settings; one instance per room) and shows the last text message of the other members of that
room. An agent can send a text, an HTML message or a file into that room.

Commands (sendTo matrix-org.0):
- send: the message is one of
  - a text (a string; a number or boolean is sent as text), or {text} ({message} or {body} work as well)
  - {html, text}: HTML as the Matrix spec allows it (e.g. <h1>, <b>, <table>); text = the plain text for
    clients that cannot show HTML (give both)
  - {file, type?}: a picture, video or other file. file: an http(s) URL (the adapter downloads it), a path on the
    ioBroker host as "file:///opt/pic.png" (Windows "file:///C:/pic.png"), "data:image/png;base64,..." or
    {type: "image/png", base64: "..."}. type: the MIME type of a file:// path; without it only PNG, GIF and JPEG
    are recognized (a URL takes the type its server sends). image/* is shown as a picture, video/* as a video,
    anything else as a file.
  Answer: for a text the string "Message computed" (also when sending failed: it is not waited for); no answer
  for HTML and files. sendTo("matrix-org.0", "Hello") without a command means send.

States (matrix-org.0.*): sendMessage: a text written there (ack false) is sent to the room (the text "image"
sends a test picture). receiveMessage: the last text message of another member of the room. info.connection:
true when the bot is logged in.

How to talk to the user:
- Every member of the room reads the messages. Send only what the user asked for; if the room has other people
  than the user, sending there needs the user's explicit request. With several instances (rooms) and no room
  named, ask which one.
- There is no delivery confirmation: say that the message was handed over; if info.connection is false, say that
  the bot is not logged in instead of sending.`;
