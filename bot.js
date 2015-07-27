var Slack = require( 'slack-client' );
var _ = require( 'underscore' )._;
var Backbone = require( 'backbone' );
var request = require( 'request' );
var SlackEngine = {
	initialize: function () {
		this.apiURL = 'http://lab.senviet.org/slackBotAPI/web/'; //replate with your webservice url
		this.token = 'xoxb-8190296064-Ah8g0jEuLpWSN3IcchkWARY6'; //replace with your token
		this.slack = new Slack( this.token, true, true );
		this.channels = [];
		this.groups = [];
		this.pubsub = {};
		_.extend( this.pubsub, Backbone.Events );
		this.regexMap = [
			{
				regex:/^dịch(?: giúp){0,1}(?: giùm){0,1}(?: câu){0,1}(?: từ){0,1}(?: chữ){0,1} [\'|\"](.*)[\'|\"](?: ra){0,1}(?: thành){0,1}(?: tiếng){0,1}(.*){0,1}/i,
				function:this.onTranslate
			}
		];
	},
	login:function(){
		this.slack.login();
	},
	run :function(){
		var self = this;
		this.login();
		this.slack.on( 'open', function () {
			self.onOpen();
		});
		this.slack.on( 'message', function (message) {
			self.onMessage(message);
			self.pubsub.trigger('message', message);
		});
	},
	/**
	 * On stack open connect
	 */
	onOpen:function(){
		var self = this;
		this.channels = (Object.keys( this.slack.channels )
			.map( function ( k ) {
				return self.slack.channels[ k ];
			} )
			.filter( function ( c ) {
				return c.is_member;
			} )
			.map( function ( c ) {
				return c.name;
			} ));
		this.groups = (Object.keys( this.slack.groups )
			.map( function ( k ) {
				return self.slack.groups[ k ];
			} )
			.filter( function ( g ) {
				return g.is_open && ! g.is_archived;
			} )
			.map( function ( g ) {
				return g.name;
			} ));

		console.log( 'Welcome to Slack. You are ' + this.slack.self.name + ' of ' + this.slack.team.name );

		if ( this.channels.length > 0 ) {
			console.log( 'You are in: ' + this.channels.join(', ') );
		}
		else {
			console.log( 'You are not in any channels.' );
		}

		if ( this.groups.length > 0 ) {
			console.log( 'As well as: ' + this.groups.join(',') );
		}
	},
	/**
	 * On message recived
	 * @param message
	 */
	onMessage:function(message){
		var type = message.type;
		var ts = message.ts;
		var text = message.text;
		var channel = this.slack.getChannelGroupOrDMByID( message.channel );
		var user = this.slack.getUserByID( message.user );
		var channelName = (channel != null ? channel.is_channel : void 0) ? '#' : '';
		channelName = channelName + (channel ? channel.name : 'UNKNOWN_CHANNEL');
		var userName = (user != null ? user.name : void 0) != null ? "@" + user.name : "UNKNOWN_USER";
		console.log("Received: " + type + " " + channelName + " " + userName + " " + ts + " \"" + text + "\"");
		if (type === 'message' && (text != null) && (channel != null)) {
			var action = this.getAction(text);
			if(action) {
				if(action.error){
					channel.send(action.error);
				}
				else {
					var apiEndPoint = this.apiURL + action.path;
					request.post( {url: apiEndPoint, formData: action.data}, function ( error, response, body ) {
						if ( ! error && response.statusCode == 200 ) {
							try {
								var responseObject = JSON.parse( body );
								if ( responseObject.errorCode ) {
									channel.send( responseObject.message );
								}
								else {
									channel.send( responseObject.message );
								}
							} catch ( e ) {
								console.log( e.message );
							}
						}
						else {
							console.log( response.statusCode );
						}
					} );
				}
			}
		} else {
			var typeError = type !== 'message' ? "unexpected type " + type + "." : null;
			var textError = text == null ? 'text was undefined.' : null;
			var channelError = channel == null ? 'channel was undefined.' : null;
			var errors = [typeError, textError, channelError].filter(function(element) {
				return element !== null;
			}).join(' ');
			return console.log("@" + this.slack.self.name + " could not respond. " + errors);
		}
	},
	getAction:function(text){
		for(var index = 0; index<this.regexMap.length; index++){
			if(this.regexMap[index].regex.exec(text) !== null ){
				return this.regexMap[index ].function.call(this, text);
			}
		}
		return null;
	},
	onTranslate:function(text){
		/*var action  ={
			path:'translate',
			data:{
				from:'vi',
				to:'cn',
				text:text
			}
		};*/
		var action = null;
		var regex = /^dịch(?: giúp){0,1}(?: giùm){0,1}(?: câu){0,1}(?: từ){0,1}(?: chữ){0,1} [\'|\"](.*)[\'|\"](?: ra){0,1}(?: thành){0,1}(?: qua){0,1}(?: sang){0,1}(?: tiếng){0,1}(.*){0,1}/i;
		var matches =regex.exec(text);
		if(matches){
			action = {
				path:'translate',
				data:{
					from:'',
					to:'',
					text:matches[1]
				}
			};
			if(matches[2]){
				var requestedLanguage = matches[2];
				var languageMap  = {
					'af':/Afrikaans/i,
					'sq':/Albanian/i,
					'ar':/Arabic|ả rập/i,
					'az':/Azerbaijani/i,
					'eu':/Basque/i,
					'bn':/Bengali/i,
					'be':/Belarusian/i,
					'bg':/Bulgarian/i,
					'Catalan':/Bulgarian/i,
					'zh-CN':/Chinese|Trung Quốc|Trung|Hoa/i,
					'hr':/Croatian/i,
					'cs':/Czech|séc/i,
					'da':/Danish/i,
					'nl':/Dutch|Hà Lan/i,
					'en':/English|anh/i,
					'eo':/Esperanto/i,
					'et':/Estonian/i,
					'tl':/Filipino/i,
					'fi':/Finnish/i,
					'fr':/French|pháp/i,
					'gl':/Galician/i,
					'ka':/Georgian/i,
					'de':/German|Đước/i,
					'el':/Greek|Hy lạp/i,
					'gu':/Gujarati/i,
					'ht':/Haitian Creole/i,
					'iw':/Hebrew/i,
					'hi':/Hindi/i,
					'is':/Icelandic/i,
					'id':/Indonesian/i,
					'ga':/IrishIrish|Ireland|Ai len/i,
					'it':/Italian|Ý|italy|itali/i,
					'ja':/Japanese|nhật|nhật bản/i,
					'kn':/Kannada/i,
					'la':/Korean|hàn quốc|hàn/i,
					'lv':/Latvian/i,
					'lt':/Lithuanian/i,
					'mk':/Macedonian/i,
					'ms':/Malay|ma lai|mã lai/i,
					'mt':/Maltese/i,
					'no':/Norwegian|na uy/i,
					'fa':/Persian|ba tư/i,
					'pl':/Polish/i,
					'pt':/Portuguese|bồ đào nha/i,
					'ro':/Romanian|rumani/i,
					'ru':/Russian|nga/i,
					'sr':/Serbian/i,
					'sk':/Slovak/i,
					'sl':/Slovenian/i,
					'es':/Spanish|tây ban nha/i,
					'sw':/Swahili/i,
					'sv':/Swedish|thụy điển/i,
					'ta':/Tamil/i,
					'te':/Telugu/i,
					'th':/Thai|thái lan|thái/i,
					'tr':/Turkish/i,
					'uk':/Ukrainian/i,
					'ur':/Urdu/i,
					'vi':/Vietnamese|Việt Nam|Việt/i,
					'cy':/Welsh/i,
					'yi':/Yiddish/i
				};
				for (var code in languageMap) {
					var langRegex = languageMap[code];
					if(langRegex.exec(requestedLanguage)){
						console.log(code);
						action.data.to = code;
						break;
					}
				}
				if(action.data.to ==''){
					var messageList  = [
						'Đừng thử mình, ngôn ngữ này đâu có tồn tại ?',
					    'Lừa mình hả, vậy thử nói ngôn ngữ này nước nào xài ?',
					    'Bạn tệ quá, thiếu tin tưởng vào cuộc sống, dám thử mình.',
					    'Ừ, mình ngu, ngôn ngữ này mình không biết',
					    'Google không hỗ trợ ngôn ngữ này, nên mình cũng vậy',
					    'Hư cấu, thật là hư cấu, ngôn ngữ này đâu có tồn tại má.',
					    'Tôi đa mệt, đừng có chọc thôi bằng thứ ngôn ngữ dị hợm đó',
					    'Chán lắm rồi, mấy người tàn bắt tôi dịch những ngôn ngữ tôi không biết',
					    'Xin lỗi quý khách, ngôn ngữ này éo có trong database',
					    'Quý khách tự sáng tạo ra ngôn ngữ này hả ?',
					    'Bạn thật vui tính, nhưng mình rất tiếc, ngôn ngữ này là 100% hư cấu.',
					];
					action.error = messageList[Math.floor(Math.random() * (messageList.length-1))];
				}
			}
		}
		console.log(action);
		return action;
	}
};


SlackEngine.initialize();
SlackEngine.run();