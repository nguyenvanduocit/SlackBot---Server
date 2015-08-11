var Slack = require( 'slack-client' );
var _ = require( 'underscore' )._;
var Backbone = require( 'backbone' );
var request = require( 'request' );
var config = require( './config.js' );
var SlackEngine = {
	initialize: function () {
		this.apiURL = 'http://slackbotapi.senviet.org'; //replate with your webservice url
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
			},{
				regex: /meme (\d+) (.*)/i,
				function: this.onMeme
			},{
				regex: /meme list/i,
				function: this.onMemeList
			},
			{
				regex: /(Github status)/i,
				function: this.onCheckGithubStatus
			},
			{
				regex: /(?:^an)(?:,){0,1} (.*)/i,
				function: this.onMention
			},
			{
				regex:/^shot (http[s]{0,1}:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/i,
				function : this.onWebShot
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
		if ( type === 'message' && (text != null) && (channel != null) && ( user != null )) {
			if(!user.is_bot) {
				var action = this.doAction( text, user, channel );
				if ( ! action ) {
					if ( channel.is_im ) {
						this.talkWithBot( text, user, channel );
					}
				}
			}
			else
			{

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
		channel.sendTyping();
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
					value: 'true'
				}, {
					name: 'locale',
					value: 'en'
				}, {
					name: 'clientFeatures',
					value: 'say,all'
				}, {
					name: 'location',
					value: '10.7730058,106.6829365'
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
	doAction: function ( text, user, channel ) {
		for ( var index = 0; index < this.regexMap.length; index ++ ) {
			if ( this.regexMap[ index ].regex.exec( text ) !== null ) {
				this.regexMap[ index ].function.call( this,text, user, channel );
				return true;
			}
		}
		return false;
	},
	onTranslate: function ( text, user, channel ) {
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
					action.error =  messageList[ Math.floor( Math.random() * (
							messageList.length - 1
						) ) ];
				}
			}
			if(!action.error){
				this.callAPI(action, user, channel);
			}
			else{
				channel.send(action.error);
			}
		}
	},
	callAPI:function(action, user, channel){
		var apiEndPoint = this.apiURL + action.path;
		request.post( {url: apiEndPoint, formData: action.data}, function ( error, response, body ) {
			if ( ! error && response.statusCode == 200 ) {
				try {
					var responseObject = JSON.parse( body );
					if ( responseObject.errorCode ) {
						channel.send( responseObject.message );
					}
					else {
						if(responseObject.type)
						{
							switch (responseObject.type){
								case 'photo':
									channel.postMessage(
										{
											username:'Meme',
											as_user:true,
											attachments:[
												{
													"fallback": "Required plain-text summary of the attachment.",
													"color": "#36a64f",
													"image_url": responseObject.image_url,
													"thumb_url": responseObject.image_url
												}
											]
										}
									);
									break;
								case 'text':
									channel.send( responseObject.message );
									break;
							}
						}
						else {
							channel.send( responseObject.message );
						}
					}
				} catch ( e ) {
					console.log( e.message);
				}
			}
			else {
				console.log(error);
			}
		} );
	},
	sendToAdmin:function(text){
		//var adminChannel = this.slack.getChannelGroupOrDMByID(this.adminChannelId);
		//adminChannel.send(text);
	},
	onMeme: function(text, user, channel){
		var regex = /meme (\d+) (.*)/;
		var matches = regex.exec(text);
		if(matches.length == 3){
			var action  ={
				path:'/meme/generate',
				data:{
					backgroundId:matches[1],
					text:matches[2]
				}
			};
			channel.sendTyping();
			this.callAPI(action, user, channel);
		}
	},
	onMemeList:function(text, user, channel){
		var action  ={
			path:'/meme/list'
		};
		channel.sendTyping();
		this.callAPI(action, user, channel);
	},
	onGetLink:function(text, user, channel){
		var action = null;
		var regex = /http:\/\/mp3\.zing\.vn\/(bai-hat|video-clip)\/(?:.*)\/(.*)\.html/;
		var matches = regex.exec(text);
		if(matches.length == 3){
			channel.sendTyping();
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
			this.callAPI(action, user, channel);
		}
		else
		{
			channel.send('I can get download link for this link.')
		}
	},
	onCheckGithubStatus:function(text, user, channel){
		channel.sendTyping();
		request.get( {url: 'https://status.github.com/api/last-message.json'}, function ( error, response, body ) {
			if ( ! error && response.statusCode == 200 ) {
				try {
					var responseObject = JSON.parse( body );
					if ( responseObject.body ) {
						channel.send( responseObject.body );
					}
				} catch ( e ) {
					console.log( e.message);
				}
			}
			else {
				console.log(error);
			}
		} );
	},
	onWebShot:function(text, user, channel){
		var regex = /(http[s]{0,1}:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/i;
		var matches = regex.exec( text );
		if ( matches !== null ) {
			var url = matches[1];
			channel.sendTyping();
			var webshot = require('webshot');

		}
	},
	onMention: function(text, user, channel){
		var regex = /(?:^an)(?:,){0,1} (.*)/i;
		var matches = regex.exec( text );
		if ( matches !== null ) {
			text = matches[1];
			if(!this.doAction( text, user, channel)){
				this.talkWithBot(text, user, channel);
			}
		}
	},
	onTranslateComplain: function (text, user, channel) {
		channel.sendTyping();
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
		var message = messageList[ Math.floor( Math.random() * (
				messageList.length - 1
			) ) ];
		channel.send(message);
	}
};


SlackEngine.initialize();
SlackEngine.run();