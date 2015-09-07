var ModuleBase = require('./Base');
class Bot extends ModuleBase{
    constructor(token) {
        super();
        this.regex = /^d?ch(?: giúp){0,1}(?: giùm){0,1}(?: câu){0,1}(?: t?){0,1}(?: ch?){0,1} [\'|\"](.*)[\'|\"](?: ra){0,1}(?: thành){0,1}(?: qua){0,1}(?: sang){0,1}(?: ti?ng){0,1}(.*){0,1}/i;
    }
}
module.exports = Bot;
