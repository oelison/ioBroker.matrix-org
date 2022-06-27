"use strict";

Blockly.Words["matrix-org_instance"] = {
    "en": "instance",
    "de": "instanz",
    "ru": "пример",
    "pt": "instância",
    "nl": "instituut",
    "fr": "instance",
    "it": "istanza",
    "es": "ejemplo",
    "pl": "instancja",
    "zh-cn": "例子"};
Blockly.Words["matrix-org_message"] = {
    "en": "message",
    "de": "nachricht",
    "ru": "сообщение",
    "pt": "mensagem",
    "nl": "bericht",
    "fr": "message",
    "it": "messaggio",
    "es": "mensaje",
    "pl": "komunikat",
    "zh-cn": "信息"};
Blockly.Words["matrix-org_anyInstance"] = {
    "en": "all instances",
    "de": "an alle",
    "ru": "все экземпляры",
    "pt": "todas as instâncias",
    "nl": "all instances",
    "fr": "tous les cas",
    "it": "tutte le istanze",
    "es": "todos los casos",
    "pl": "wszystkie instancje",
    "zh-cn": "所有案件"};
Blockly.Words["matrix-org_toolTip"] =  {
    "en": "send a message to matrix push service",
    "de": "eine nachricht an matrix push service senden",
    "ru": "отправить сообщение в службу matrix push",
    "pt": "enviar uma mensagem para serviço de push de matrix",
    "nl": "stuur een bericht naar matrix",
    "fr": "envoyer un message au service push matrix",
    "it": "inviare un messaggio a matrix push service",
    "es": "enviar un mensaje al servicio de empuje de matrix",
    "pl": "wysłać wiadomość do obsługi matrix push service",
    "zh-cn": "发出信息,推动矩阵服务"};
Blockly.Sendto.blocks["matrix-org"] =
    "<block type='matrix-org'>"
    + "     <value name='INSTANCE'>"
    + "     </value>"
    + "     <value name='MESSAGE'>"
    + "         <shadow type='text'>"
    + "             <field name='TEXT'>text</field>"
    + "         </shadow>"
    + "     </value>"
    + "</block>";

Blockly.Blocks["matrix-org"] = {
    init: function() {
        var options = [[Blockly.Words["matrix-org_anyInstance"][systemLang], ""]];
        if (typeof main !== 'undefined' && main.instances) {
            for (var i = 0; i < main.instances.length; i++) {
                var m = main.instances[i].match(/^system.adapter.matrix-org.(\d+)$/);
                if (m) {
                    var k = parseInt(m[1], 10);
                    options.push(['matrix-org.' + k, '.' + k]);
                }
            }
            if (options.length === 0) {
                for (var u = 0; u <= 4; u++) {
                    options.push(['matrix-org.' + u, '.' + u]);
                }
            }
        } else {
            for (var n = 0; n <= 4; n++) {
                options.push(['matrix-org.' + n, '.' + n]);
            }
        }

        this.appendDummyInput("INSTANCE")
            .appendField(Blockly.Words["matrix-org_instance"][systemLang])
            .appendField(new Blockly.FieldDropdown(options), "INSTANCE");

        this.appendValueInput("MESSAGE")
            .appendField(Blockly.Words["matrix-org_message"][systemLang]);

        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);

        this.setColour(Blockly.Sendto.HUE);
        this.setTooltip(Blockly.Words["matrix-org_toolTip"][systemLang]);
        this.setHelpUrl("https://github.com/oelison/ioBroker.matrix-org#readme");
    }
};

Blockly.JavaScript["matrix-org"] = function(block) {
    var dropdown_instance = block.getFieldValue("INSTANCE");
    var value_message = Blockly.JavaScript.valueToCode(block, "MESSAGE", Blockly.JavaScript.ORDER_ATOMIC);
    return "sendTo('matrix-org" + dropdown_instance + "', " + value_message + ");";
};
