var ModuleBase = require('./Base');
class Bot extends ModuleBase{
    constructor(token) {
        super();
        this.regex = /^d?ch(?: gi�p){0,1}(?: gi�m){0,1}(?: c�u){0,1}(?: t?){0,1}(?: ch?){0,1} [\'|\"](.*)[\'|\"](?: ra){0,1}(?: th�nh){0,1}(?: qua){0,1}(?: sang){0,1}(?: ti?ng){0,1}(.*){0,1}/i;
    }
}
module.exports = Bot;
