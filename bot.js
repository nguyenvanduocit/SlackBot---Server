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
				regex: /(?:^an_map)(?:,){0,1} (.*)/i,
				function: this.onMention
			},
			{
				regex:/^(.*) quote/i,
				function : this.onFunnyQuote
			},{
				regex:/^fun fact about (.*)/i,
				function : this.onFunFact
			},
			{
				regex:/^(?:horo|horoscope|day|today) of (.*)/i,
				function : this.onHoro
			},
			{
				regex:/^help/i,
				function : this.onHelp
			},
			{
				regex:/^test (.*)/i,
				function : this.onQuiz
			},
			{
				regex:/^(\d)$/,
				function : this.onQuiz
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
					'lo': /Lào/i,
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
						channel.send( responseObject.text );
					}
					else {
						if(responseObject.type)
						{
							switch (responseObject.type){
								case 'attachment':
									channel.postMessage(
										{
											username:'thuy_an',
											as_user:true,
											attachments:[
												{
													title: responseObject.title,
													title_link: responseObject.title_link,
													fallback: responseObject.fallback,
													color: responseObject.color,
													image_url: responseObject.image_url,
													thumb_url: responseObject.thumb_url,
													text: responseObject.text,
													pretext:responseObject.pretext,
													author_name:responseObject.author_name,
													author_link:responseObject.author_link,
													author_icon:responseObject.author_icon,
													fields: responseObject.fields
												}
											]
										}
									);
									break;
								case 'text':
									channel.send( responseObject.text );
									break;
							}
						}
						else {
							channel.send( responseObject.text );
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
	onQuiz:function(text, user, channel){
		Quizzer.onRequest(text, user, channel);
	},
	onHelp:function(text, user, channel){
		channel.sendTyping();
		channel.postMessage(
			{
				username:'Meme',
				as_user:true,
				attachments:[
					{
						text: 'Dưới đây là những gì mà An Mập có thể hỗ trợ cho bạn, Thay cụm [] và {} thành các giá trị mà bạn muốn, ký hiệu [] nghĩa không bắt buộc, {} nghĩa là bắt buộc',
						fields: [
							{
								title: "Dịch thuật",
								value: 'Dịch "{Nội dung cần dịch}" [qua tiếng anh|đức|pháp|thái|....]',
								short: false
							},
							{
								title: "Meme",
								value: 'meme {số từ 1 tới 10} {nội dung}',
								short: false
							},
							{
								title: "Getlink nhạc 320",
								value: 'getlink {link bài hát ở mp3.zing.vn}',
								short: false
							},{
								title: "Kiểm tra status của github",
								value: 'Github status',
								short: false
							},{
								title: "Câu nói vui",
								value: '{funny|programming} quote',
								short: false
							},{
								title: "Cung hoàng đạo",
								value: '{horo|day|horoscope} of {tên cung bằng tiếng Anh}',
								short: false
							},
							{
								title: "Chat thông minh",
								value: 'Chỉ cần mở DM lên và chat là được',
								short: false
							},
							{
								title: "Fun fact",
								value: 'fun fact about {programming}',
								short: false
							}
						]
					}
				]
			}
		);
	},
	onHoro:function(text, user, channel){
		var regex = /^(?:horo|horoscope|day|today) of (.*)/i;
		var matches = regex.exec( text );
		if ( matches !== null ) {
			var sign = matches[1];
			var action  ={
				path:'/horoscope',
				data:{
					sign:sign
				}
			};
			channel.sendTyping();
			this.callAPI(action, user, channel);
		}
	},
	onFunnyQuote:function(text, user, channel){
		var regex = /^(.*) quote/i;
		var matches = regex.exec( text );
		if ( matches !== null ) {
			var category = matches[1];
			var action  ={
				path:'/quote',
				data:{
					category:category
				}
			};
			channel.sendTyping();
			this.callAPI(action, user, channel);
		}
	},
	onFunFact:function(text, user, channel){
		var regex = /^fun fact about (.*)/i;
		var matches = regex.exec( text );
		if ( matches !== null ) {
			var category = matches[1];
			var action  ={
				path:'/funnyimage/random',
				data:{
					category:category
				}
			};
			channel.sendTyping();
			this.callAPI(action, user, channel);
		}
	},
	onMention: function(text, user, channel){
		var regex = /(?:^an_map)(?:,){0,1} (.*)/i;
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

/**
 * this is the place of quizzer
 * @type {{isReady: boolean, apiEndPoint: string, categories: Array, regexMap: Array, CONTEXT: {STOP: string, START: string, SELECT_TEST: string, ANSWERING: string, WAITING_FOR_QUESTION: string, CHECKING_FOR_ANSWER: string}, initialize: Function, onRequest: Function, start: Function, chooseCategory: Function, sendCategory: Function, getCategoryFieldList: Function, stop: Function, getRandomQuestion: Function, checkAnswer: Function, getTestList: Function, setTestContext: Function, fetchCategory: Function}}
 */

var Quizzer = {
	isReady :false,
	apiEndPoint:'http://smarterer.vn/wp-admin/admin-ajax.php',
	categories:{},
	regexMap : [],
	CONTEXT:{
		'STOP':'stop',
		'START':'start',
		'SELECT_TEST':'select_test',
		'WAITING_FOR_ANSWER':'answering',
		'WAITING_FOR_QUESTION':'waiting_for_question',
		'CHECKING_FOR_ANSWER':'checking_for_answer'
	},
	initialize:function(){
		this.pubsub = {};
		_.extend( this.pubsub, Backbone.Events );
		this.regexMap = [
			{
				regex:/(?:test) (start)(?: ){0,1}(.*){0,1}/i,
				function:this.start
			},
			{
				regex:/(?:test) (stop)/i,
				function:this.stop
			},
			{
				regex:/(?:test) (?:choose) (.*)/i,
				function:this.chooseCategory
			},
			{
				regex:/^(\d)$/,
				function:this.onAnswer
			}
		];
		this.fetchCategory();
	},
	onRequest:function(text, user, channel){

		if(!this.isReady){
			channel.send('I am not ready, please try in a minute.');
			return false
		}
		for ( var index = 0; index < this.regexMap.length; index ++ ) {
			var matchs = this.regexMap[ index ].regex.exec( text );
			if (  matchs ) {
				if(matchs[1] !=='start' && !channel.hasOwnProperty('quizz')){
					channel.send('Type "test start" to start a test');
					return false;
				}
				this.regexMap[ index ].function.call( this,text, user, channel, matchs );
				return true;
			}
		}
		return false;
	},
	start:function(text, user, channel, matchs){
		var self = this;
		/**
		 * Reset the quizz
		 * @type {{}}
		 */
		channel.quizz = {};
		channel.quizz.context = this.CONTEXT.SELECT_TEST;
		this.pubsub.trigger('onStart');
		channel.sendTyping();

		channel.send('Your have to choose a category');
		this.sendCategory( channel );
	},
	onAnswer:function(text, user, channel, matchs){
		channel.sendTyping();
		if(channel.quizz.context ===this.CONTEXT.WAITING_FOR_ANSWER){
			var answerIndex = matchs[1];
			if(answerIndex > channel.quizz.currentQuestion.choices.length){
				channel.send('Troll me, huh ?');
				return false;
			}
			/**
			 * answerIndex-1 because we +1 when showing the answer list
			 */
			var answerValue = channel.quizz.currentQuestion.choices[answerIndex-1];
			if( answerValue == channel.quizz.currentQuestion.answer ){
				channel.send('Dung');
				channel.context = this.CONTEXT.WAITING_FOR_QUESTION;
				this.sendRandomQuestion(channel.quizz.category, channel);
			}
			else
			{
				channel.send('Sai');
			}
		}
		else{
			channel.send('Not answer this time');
		}
	},
	chooseCategory:function(text, user, channel, matchs){
		channel.sendTyping();
		var choiceCategory = matchs[1];
		if(this.categories.hasOwnProperty(choiceCategory)){
			channel.send('Your choose category ' + matchs[1]);
			channel.quizz.category = choiceCategory;
			this.pubsub.trigger('onCategorySelected');
			this.sendRandomQuestion(choiceCategory, channel);
		}
		else
		{
			channel.send('This category is no exist.');
			this.sendCategory(channel);
		}
	},
	sendRandomQuestion:function(category, channel){
		var self = this;
		request.post( {url: this.apiEndPoint, formData: {'action' :'wpq-slack-get-question', category:category, method:'random'}}, function ( error, response, body ) {
			if ( ! error && response.statusCode == 200 ) {
				try {
					var responseObject = JSON.parse( body );
					if(responseObject.success){
						/**
						 * - choices string[]
						 * - question string
						 * - answer string
						 */
						var question = responseObject.data;
						channel.quizz.currentQuestion = question;
						channel.quizz.context = self.CONTEXT.WAITING_FOR_ANSWER;
						var choices = [];
						_.each(question.choices, function(choice, index){
							choices.push({
								title:(index + 1) + " : " +decodeURIComponent(choice),
								short:false
							});
						});
						channel.postMessage(
							{
								username:'an_map',
								as_user:true,
								color:'#FF3300',
								attachments:[
									{
										title: question.question,
										fields:choices
									}
								],
								icon_emoji:':chart_with_upwards_trend:'
							}
						);
					}
					else
					{
						channel.send(responseObject.message);
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
	sendCategory:function(channel){
		var fields = [];
		if(this.categories){
			fields = this.getCategoryFieldList();
			/**
			 * This channel have no category
			 */
			channel.postMessage(
				{
					username:'an_map',
					as_user:true,
					color:'#FF3300',
					attachments:[
						{
							title: 'Please choose a category',
							text: 'to select, just type the name of category',
							fields:fields
						}
					]
				}
			);
		}
	},
	getCategoryFieldList:function(){
		var fields = [];
		_.each(this.categories, function(category){
			fields.push({
				"title": category.slug,
				"value":  category.count +" questions.\n"+  category.description,
				"short": true
			});
		});
		return fields;
	},
	stop:function(text, user, channel){
		if(channel.quizz) {
			delete(
				channel.quizz
			);
			channel.send( 'Thanks for testing. to start, just type "quizz start"' );
		}
		else
		{
			channel.send( 'Your have no test to stop' );
		}
	},
	getRandomQuestion:function(){
		this.CONTEXT=this.CONTEXT.WAITING_FOR_QUESTION;
	},
	checkAnswer:function() {

	},
	getTestList:function(){

	},
	setTestContext:function(){

	},
	fetchCategory:function(successCallback, failCallback){
		var self = this;
		request.post( {url: this.apiEndPoint, formData: {'action' :'wpq-slack-get-test'}}, function ( error, response, body ) {
			if ( ! error && response.statusCode == 200 ) {
				try {
					var responseObject = JSON.parse( body );
					if(responseObject.success){
						for(var index = 0; index<responseObject.data.length; index++){
							var category =  responseObject.data[index];
							self.categories[category.slug] = category;
						}
						self.isReady = true;
						if(successCallback){
							successCallback.call(self.categories);
						}
					}
					else
					{
						if(failCallback){
							failCallback.call( responseObject.message);
						}
					}
				} catch ( e ) {
					if(failCallback){
						failCallback.call( e.message);
					}
					console.log( e.message);
				}
			}
			else {
				console.log(error);
			}
		} );
	}
};
Quizzer.initialize();