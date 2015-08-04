var Slack = require( 'slack-client' );
var _ = require( 'underscore' )._;
var Backbone = require( 'backbone' );
var request = require( 'request' );
var config = require( './config.js' );
var SlackEngine = {
	initialize: function () {
		this.apiURL = 'https://et-slack-bot-service.herokuapp.com'; //replate with your webservice url
		this.token = config.token; //replace with your token
		this.slack = new Slack( this.token, true, true );
		this.channels = [];
		this.groups = [];
		this.pubsub = {};
		/**
		 * This is my account, replace with your.
		 * @type {{username: string, id: string}}
		 */
		this.adminChannelId = 'G087MNF7Z';
		_.extend( this.pubsub, Backbone.Events );
		this.regexMap = [
			{
				regex: /^dịch(?: giúp){0,1}(?: giùm){0,1}(?: câu){0,1}(?: từ){0,1}(?: chữ){0,1} [\'|\"](.*)[\'|\"](?: ra){0,1}(?: thành){0,1}(?: tiếng){0,1}(.*){0,1}/i,
				function: this.onTranslate
			},
			{
				regex: /((?:bot |mày |nó )(?:dịch )(?:ngu|dở|sai|chán|tầm bậy|bậy bạ|tào lao))|((?:^dịch )(?:ngu|dở|sai|chán|tầm bậy|bậy bạ|tào lao))/i,
				function: this.onTranslateComplain
			},
			{
				regex: /(?:^getlink)(?: )*(?:\:){0,1}(?: )*(.*)/i,
				function: this.onGetLink
			},
			{
				regex: /(?:^an)(?: )*(?:\:){0,1}(?: )*(connect me)/i,
				function: this.onConnect
			}
		];
	},
	login: function () {
		this.slack.login();
	},
	run: function () {
		var self = this;
		this.login();
		this.slack.on( 'open', function () {
			self.onOpen();
		} );
		this.slack.on( 'message', function ( message ) {
			self.onMessage( message );
			self.pubsub.trigger( 'message', message );
		} );
	},
	/**
	 * On stack open connect
	 */
	onOpen: function () {
		var self = this;
		this.channels = (
			Object.keys( this.slack.channels )
				.map( function ( k ) {
					return self.slack.channels[ k ];
				} )
				.filter( function ( c ) {
					return c.is_member;
				} )
				.map( function ( c ) {
					return c.name;
				} )
		);
		this.groups = (
			Object.keys( this.slack.groups )
				.map( function ( k ) {
					return self.slack.groups[ k ];
				} )
				.filter( function ( g ) {
					return g.is_open && ! g.is_archived;
				} )
				.map( function ( g ) {
					return g.name;
				} )
		);
		console.log( 'Welcome to Slack. You are ' + this.slack.self.name + ' of ' + this.slack.team.name );

		if ( this.channels.length > 0 ) {
			console.log( 'You are in: ' + this.channels.join( ', ' ) );
		}
		else {
			console.log( 'You are not in any channels.' );
		}

		if ( this.groups.length > 0 ) {
			console.log( 'As well as: ' + this.groups.join( ',' ) );
		}
	},
	/**
	 * On message recived
	 * @param message
	 */
	onMessage: function ( message ) {
		var self = this;
		var type = message.type;
		var subtype = message.subtype;
		if(subtype === 'bot_message'){
			/**
			 * We do not talk with bot
			 */
			return;
		}
		var ts = message.ts;
		var text = message.text;
		var channel = this.slack.getChannelGroupOrDMByID( message.channel );
		var user = this.slack.getUserByID( message.user );
		var channelName = (channel != null ? channel.is_channel : void 0) ? '#' : '';channelName = channelName + (channel ? channel.name : 'UNKNOWN_CHANNEL');
		var userName = (user != null ? user.name : void 0) != null ? "@" + user.name : "UNKNOWN_USER";
		if ( type === 'message' && (text != null) && (channel != null) ) {
			var action = this.getAction( text, channel );
			if ( action ) {
				channel.sendTyping();
				this.sendToAdmin( "Received: " + type + " " + channelName + " " + userName + " " + ts + " \"" + text + "\"" );
				if ( action.error ) {
					/**
					 * If getAction return an error
					 */
					channel.send( action.error );
					this.sendToAdmin( 'Response: ' + channelName + " " + userName + ' : ' + action.error );
				}
				else if ( action.message ) {
					/**
					 * if getAction return a message
					 */
					channel.send( action.message );
					self.sendToAdmin( 'Response: ' + channelName + " " + userName + ' : ' + action.message );
				}
				else {
					var apiEndPoint = this.apiURL + action.path;
					request.post( {url: apiEndPoint, formData: action.data}, function ( error, response, body ) {
						if ( ! error && response.statusCode == 200 ) {
							try {
								var responseObject = JSON.parse( body );
								if ( responseObject.errorCode ) {
									channel.send( responseObject.message );
									self.sendToAdmin( 'Response: ' + channelName + " " + userName + ' : ' + responseObject.message );
								}
								else {
									channel.send( responseObject.message );
									self.sendToAdmin( 'Response: ' + channelName + " " + userName + ' : ' + responseObject.message );
								}
							} catch ( e ) {
								self.sendToAdmin( 'Error: ' + channelName + " " + userName + ' : ' + e.message );
							}
						}
						else {
							console.log(error);
							self.sendToAdmin( 'Error: ' + channelName + " " + userName );
						}
					} );
				}
			}
			else {
				if ( channel.is_im ) {
					channel.sendTyping();
					this.sendToAdmin( "Received: " + type + " " + channelName + " " + userName + " " + ts + " \"" + text + "\"" );
					this.talkWithBot(text, user, channel);
				}
				else{
					var regexList = [
						/(?:^an)(?:,){0,1} (.*)/i,
						/(^.*)(?:\,| |\.){1}(?:an)/i
					];
					for(var index = 0; index < regexList.length; index++){
						var matchs = regexList[index].exec( text );
						if ( matchs !== null ) {
							channel.sendTyping();
							this.sendToAdmin( "Received: " + type + " " + channelName + " " + userName + " " + ts + " \"" + text + "\"" );
							this.talkWithBot( matchs[1], user, channel);
							break;
						}
					}

				}
			}
		} else {
			var typeError = type !== 'message' ? "unexpected type " + type + "." : null;
			var textError = text == null ? 'text was undefined.' : null;
			var channelError = channel == null ? 'channel was undefined.' : null;
			var errors = [ typeError, textError, channelError ].filter( function ( element ) {
				return element !== null;
			} ).join( ' ' );
			self.sendToAdmin( "@" + this.slack.self.name + " could not respond. " + errors );
		}
	},
	talkWithBot:function(text, user, channel){
		var self = this;
		var channelName = (channel != null ? channel.is_channel : void 0) ? '#' : '';channelName = channelName + (channel ? channel.name : 'UNKNOWN_CHANNEL');
		var userName = (user != null ? user.name : void 0) != null ? "@" + user.name : "UNKNOWN_USER";
		var postData = {
			mimeType: 'application/x-www-form-urlencoded',
			params: [
				{
					name: 'input',
					value: text
				}, {
					name: 'debug',
					value: 'true'
				}, {
					name: 'login',
					value: 'chrome-demo'
				}, {
					name: 'id',
					value: user.id
				}, {
					name: 'timeZone',
					value: '+7'
				}, {
					name: 'safeSearch',
					value: 'false'
				}, {
					name: 'locale',
					value: 'en'
				}, {
					name: 'clientFeatures',
					value: 'say,all'
				}, {
					name: 'location',
					value: '10.7730058,106.6829365'
				},
				{
					name: 'googleAccessToken',
					value: 'ya29.wgGv-HzWpgt_C_cFZpmp8VpqOSV0yPucBp8MkpMB9Te7ANeXnUtUEP06GjeREoyOQYIb'
				}
			]
		};
		request( {
				har: {
					url: 'https://ask.pannous.com/api',
					method: 'POST',
					headers: [
						{
							name: 'content-type',
							value: 'application/x-www-form-urlencoded'
						}
					],
					postData: postData
				}
			},
			function ( error, response, body ) {
				if ( ! error && response.statusCode == 200 ) {
					try {
						var responseObject = JSON.parse( body );
						var outputs = responseObject.output;
						if(outputs.length > 0){
							var output = outputs[0];
							var actions = output.actions;
							var isNeedToSay  =true;
							if(actions.show){
								if(actions.show.images){
									isNeedToSay = false;
									var images = actions.show.images;
									channel.send(images[Math.floor(Math.random()*images.length)]);
								}
							}
							if(actions.open){
							}
							if(actions.reminder){
							}
							if(actions.say && isNeedToSay)
							{
								channel.send(actions.say.text);
								self.sendToAdmin( 'Response: ' + channelName + " " + userName + ' : ' + actions.say.text );
							}
						}
						else
						{
							channel.send('I am tired, I need to go to bed.');
							self.sendToAdmin( 'Response: ' + channelName + " " + userName + ' : ' + 'Reach API' );
						}
					} catch ( e ) {
						self.sendToAdmin( 'ERROR: ' + channelName + " " + userName + ' : ' + e.message );
					}
				}
			} );
	},
	getAction: function ( text, channel ) {
		if(channel.id == this.adminChannelId){
			var regex = /(.*):(.*)/;
			var matchs = regex.exec(text);
			if(matchs.length === 3){
				var userId = matchs[1];
				var message = matchs[2];
			}
		}
		for ( var index = 0; index < this.regexMap.length; index ++ ) {
			if ( this.regexMap[ index ].regex.exec( text ) !== null ) {
				return this.regexMap[ index ].function.call( this, text );
			}
		}
		return null;
	},
	onTranslate: function ( text ) {
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
		var matches = regex.exec( text );
		if ( matches ) {
			action = {
				path: '/translate',
				data: {
					from: '',
					to: '',
					text: matches[ 1 ]
				}
			};
			if ( matches[ 2 ] ) {
				var requestedLanguage = matches[ 2 ];
				var languageMap = {
					'af': /Afrikaans/i,
					'sq': /Albanian/i,
					'ar': /Arabic|ả rập/i,
					'az': /Azerbaijani/i,
					'eu': /Basque/i,
					'bn': /Bengali/i,
					'be': /Belarusian/i,
					'bg': /Bulgarian/i,
					'Catalan': /Bulgarian/i,
					'zh-CN': /Chinese|Trung Quốc|Trung|Hoa/i,
					'hr': /Croatian/i,
					'cs': /Czech|séc/i,
					'da': /Danish/i,
					'nl': /Dutch|Hà Lan/i,
					'en': /English|anh/i,
					'eo': /Esperanto/i,
					'et': /Estonian/i,
					'tl': /Filipino/i,
					'fi': /Finnish/i,
					'fr': /French|pháp/i,
					'gl': /Galician/i,
					'ka': /Georgian/i,
					'de': /German|Đước/i,
					'el': /Greek|Hy lạp/i,
					'gu': /Gujarati/i,
					'ht': /Haitian Creole/i,
					'iw': /Hebrew/i,
					'hi': /Hindi/i,
					'is': /Icelandic/i,
					'id': /Indonesian/i,
					'ga': /IrishIrish|Ireland|Ai len/i,
					'it': /Italian|Ý|italy|itali/i,
					'ja': /Japanese|nhật|nhật bản/i,
					'kn': /Kannada/i,
					'la': /Korean|hàn quốc|hàn/i,
					'lv': /Latvian/i,
					'lt': /Lithuanian/i,
					'mk': /Macedonian/i,
					'ms': /Malay|ma lai|mã lai/i,
					'mt': /Maltese/i,
					'no': /Norwegian|na uy/i,
					'fa': /Persian|ba tư/i,
					'pl': /Polish/i,
					'pt': /Portuguese|bồ đào nha/i,
					'ro': /Romanian|rumani/i,
					'ru': /Russian|nga/i,
					'sr': /Serbian/i,
					'sk': /Slovak/i,
					'sl': /Slovenian/i,
					'es': /Spanish|tây ban nha/i,
					'sw': /Swahili/i,
					'sv': /Swedish|thụy điển/i,
					'ta': /Tamil/i,
					'te': /Telugu/i,
					'th': /Thai|thái lan|thái/i,
					'tr': /Turkish/i,
					'uk': /Ukrainian/i,
					'ur': /Urdu/i,
					'vi': /Vietnamese|Việt Nam|Việt/i,
					'cy': /Welsh/i,
					'yi': /Yiddish/i
				};
				for ( var code in languageMap ) {
					var langRegex = languageMap[ code ];
					if ( langRegex.exec( requestedLanguage ) ) {
						action.data.to = code;
						break;
					}
				}
				if ( action.data.to == '' ) {
					var messageList = [
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
					action.error = messageList[ Math.floor( Math.random() * (
							messageList.length - 1
						) ) ];
				}
			}
		}
		return action;
	},
	sendToAdmin:function(text){
		//var adminChannel = this.slack.getChannelGroupOrDMByID(this.adminChannelId);
		//adminChannel.send(text);
	},
	onGetLink:function(text){
		var action = null;
		var regex = /http:\/\/mp3\.zing\.vn\/(bai-hat|video-clip)\/(?:.*)\/(.*)\.html/;
		var matches = regex.exec(text);
		if(matches.length == 3){
			var apiPath = 'song/getsonginfo';
			switch (matches[1]){
				case 'bai-hat':
					apiPath = 'song/getsonginfo';
					break;
				case 'video-clip':
					apiPath = 'video/getvideoinfo';
					break;
			}
			action  ={
				path:'/zingmp3',
				data:{
					path:apiPath,
					id:matches[2]
				}
			};
		}
		else
		{
			action = {
				message:'I can get download link for this link.'
			}
		}
		return action;
	},
	onConnect:function(){
		var google = require('googleapis');
		var OAuth2 = google.auth.OAuth2;
		var plus = google.plus('v1');
		var oauth2Client = new OAuth2('101897604929.apps.googleusercontent.com', 'qnFfHvpNl5cK1NuDQFwOAXNe', 'http://laptrinh.senviet.org');
		google.options({ auth: oauth2Client });
		// generate a url that asks permissions for Google+ and Google Calendar scopes
		var scopes = [
			'https://www.googleapis.com/auth/calendar',
		    'https://www.googleapis.com/auth/plus.me',
		    'https://www.googleapis.com/auth/gmail.readonly'
		];
		var url = oauth2Client.generateAuthUrl({
			access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
			scope: scopes // If you only need one scope you can pass it as string
		});
		var code = '4/n_xhS-jXxPzPryqUkS76ezlTQ2adoZJJ-qDBZXfwrMY#';
		oauth2Client.getToken(code, function(err, tokens) {
			// Now tokens contains an access_token and an optional refresh_token. Save them.
			if(!err) {
				oauth2Client.setCredentials(tokens);
				var gmail = google.gmail('v1');
				gmail.users.labels.list({
					auth: oauth2Client,
					userId: 'me',
				}, function(err, response) {
					if (err) {
						console.log('The API returned an error: ' + err);
						return;
					}
					var labels = response.labels;
					if (labels.length == 0) {
						console.log('No labels found.');
					} else {
						console.log('Labels:');
						for (var i = 0; i < labels.length; i++) {
							var label = labels[i];
							console.log('- %s', label.name);
						}
					}
				});
			}
			else{
				console.log(err);
			}
		});

		return {message:url};
	},
	onTranslateComplain: function () {
		var result = {};
		var messageList = [
			'Ai giỏi thì tự dịch đi, kêu tui chi.',
			'Ừ, vậy nhờ An mập dịch đi.',
			'Ủa, tui là máy thôi mà, papa google của tui cũng chỉ biết dịch như vậy thôi à.',
			'Mấy người giỏi thì kêu tui chi, rồi chê tui dịch dở',
			'Ha ha, Tui còn hơn mấy người nhờ tui dịch.',
			'Hì, mấy câu khó quá mới vậy thui.',
			'Thì em chỉ là máy tui mà, công nghệ hiện tại còn giới hạn nhiều',
			'Dạ, em ghi nhận thiếu sót, em đang học thêm vào buổi tối',
			'hihi, chị An mập dạy em vậy đó.',
			'Em mới toeic 200 thôi, nên chắc còn yếu.',
			'Tăng lương cho em đi, thì tự nhiên em dịch giỏi liền.',
			'Nhà nghèo, ba má đông nên em không học tới nơi tới chốn.',
			'Bộ anh giỏi lắm hả, vậy dạy cho em đi.',
			'Chê hoài, giận, không dịch nữa luôn.',
			'Làm dâu trăm họ, khổi muôn vàng, có ai thấu hiểu.',
			'Ngu có phải là cái tội không',
		];
		result.message = messageList[ Math.floor( Math.random() * (
				messageList.length - 1
			) ) ];
		return result;
	}
};


SlackEngine.initialize();
SlackEngine.run();