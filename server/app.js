/****************************************************************************
 * PROPER LICENSE AND AUTHOR INFORMATION GOES HERE
 * 
 * 
 * 
 * 
 * 
 * 
 ***************************************************************************/






/**
 * Module dependencies.
 */

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
//var https = require('https');
var session = require('express-session');
//var cookerParser = require('cookie-parser');
var _ = require('underscore');
var ip = require('ip');
var request = require('request');


//##################### Added for Text to Speech #########################

//Will place variable declarations at its appropriate place once command to Pi is complete

//require('./config/express')(app);
//To save file in /public
var fs = require('fs');
var extend =  extend = require('util')._extend;
var bluemix = require('./config/bluemix');
var watson = require('watson-developer-cloud');

//Get credentials from Text to Speech service
var credentials = extend({
  version: 'v1',
  username: '<username>',
  password: '<password>',
  headers: { 'Accept': 'audio/ogg; codecs=opus' }
}, bluemix.getServiceCreds('text_to_speech')); // VCAP_SERVICES, imported directly from the service

var textToSpeech = new watson.text_to_speech(credentials);
var objectstring, obj, transcript, speechFile;

//Following line is converted to speech.objectstring
//Play the following message once the games begin ?
objectstring = '{"download":"true","text":"Let the games begin. ","voice":"VoiceEnUsMichael"}'; //change voice to VoiceEnUs
obj = JSON.parse(objectstring);
transcript = textToSpeech.synthesize(obj);
speechFile = __dirname + "/public/BeginGames.ogg";
transcript.pipe(fs.createWriteStream(speechFile)); //saves the file on bluemix server under /home/vcap/app/fileToBePlayedOnPi.ogg. to be pulled by Pi
transcript.on('end', function() {
  console.log('***** It\'s saved in ' + speechFile + " ************* ");
});
transcript.on('error',console.error);

//TODO: Issue command to Pi to play "BeginGames.ogg"

//##################### End of Text to Speech (Check storeGoals() to generate appropriate audio) ##############################################




//change to false for quiet runtime
var debug = true;
var tweet = "";

if (debug) {
	console.log("Starting FoosBuzz application.");
}

//#########################################################################
//######################## Variable Declaration ###########################
//#########################################################################

//TODO Change for each location. This is the location value that will be stored in the database
var location = "Austin"; 

//Will be used to perform operations on the database
var gameLocation;
var db; 

var TeamOneLoggedIn = false;
var TeamTwoLoggedIn = false;

//DB credentials holds the name of your db. 
var dbCredentials = {
	dbName : 'games'
};

//Used to hold player data when sending the league info to the front end to display the leaderboard
var league = {
	data : [] 
}; 

//Used to hold goal values received from the table
var savegoal; 

var services = JSON.parse(process.env.VCAP_SERVICES || "{}");
var host = process.env.VCAP_APP_HOST || 'localhost';
var port = process.env.VCAP_APP_PORT || 8080;

//Setup EJS middleware
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(__dirname+ '/public'));
app.use(session({
	secret: 'supersecretsquirrel',
	cookie: { maxAge: 60000 },
	resave: true,
	saveUnitialized: false
}));
app.set('views', __dirname + '/public');
app.set ('view engine', 'ejs');


//Require Socket.IO, Start The Server 
var io = require('socket.io').listen(app.listen(port, host));
console.log('App started on port ' + port);
console.log(ip.address());


//1. CLOUDANT DATABASE ACCESS SETUP++++
function initDBConnection() {
	
	if(process.env.VCAP_SERVICES) {
		services = JSON.parse(process.env.VCAP_SERVICES);	
		if(services.cloudantNoSQLDB) {
			dbCredentials.url = services.cloudantNoSQLDB[0].credentials.url;
		}
		console.log('VCAP Services: '+JSON.stringify(process.env.VCAP_SERVICES));
		
		host = process.env.VCAP_APP_HOST; 
  		port = process.env.VCAP_APP_PORT;
  		console.log("app is in bluemix");
	}

	//Load nano Module to interface with cloudant
	var nano = require('nano')(dbCredentials.url);
	
	//Create database
	nano.db.create(dbCredentials.dbName, function (err, res) {
		if (err) {
			console.log('could not create db');
		    console.log("ERROR:" , err);
		    console.log("RES:" , res);
		}
	});
    
    //Creating a variable that points to the proper database
	db = nano.use(dbCredentials.dbName);

}

//Connect to the database
initDBConnection();

if (debug) {
	console.log("Database connectivity established.");
}

//Create a GameObject class
function GameObject(location) {[
 	this.gameID = null,
 	this.userTeamTwo = "anonymous",
 	this.userTeamOne = "incognito",
 	this.goalsTeamTwo = 0,
 	this.goalsTeamOne = 0,
 	this.location = location,
 	this.timestamp = null,
 	this.startTime = null,
 	this.isActive = false 
];}

//Create a leagueplayer class
function leagueplayer() {[
	this.linkedinID = null,
	this.name = null,
	this.photo = null,
	this.company = null,
	this.goalsAndAgainstgoals = null,
	this.goaldif = null,
	this.wins = 0,
	this.loses = 0,
	this.points = 0,
	this.games = 0
];}

//Function to return the current time in hh:mm format
getcurrentTime = function(){
	var thisdate = new Date();
	var current_hour = thisdate.getHours();
	var current_minutes = ('0'+thisdate.getMinutes()).slice(-2);
	var current_time = current_hour + ":" + current_minutes;
	return current_time;    
};

//Create an object of class GameObject
gameLocation = new GameObject(location);

if (debug) {
	console.log("new gameObject("+location+")");
	console.log(gameLocation);
}

//#########################################################################
//############################### Routes ##################################
//#########################################################################

// Render index page - acts as live feed of game
app.get('/', /* @callback */ function(req, res){    
    res.render('index');
});

// Render league page
app.get('/league', /* @callback */ function(req, res) {
    res.render('league');
});

//Render static about page
app.get('/about', /* @callback */ function(req, res) {
    res.render('about');
});      

//End game functionality
app.get('/endGame', /* @callback */ function(req,res) {
	endGame();
    res.sendStatus(200);
});

//Start game functionality
app.get('/startGame', /* @callback */ function(req, res) {     
    startGame();
    res.sendStatus(200);
});

//Passes a result object to the client in order to retain game data
app.get('/statuscheck', /* @callback */ function(req, res) {
    
    gameFile = gameLocation;
    
    var result = {
        gameisopen: gameFile.isActive,
        userTeamTwo: gameFile.userTeamTwo,
        userTeamTwoPhoto: gameFile.userTeamTwoPhoto,
        userTeamOne: gameFile.userTeamOne,
        userTeamOnePhoto: gameFile.userTeamOnePhoto,
        goalsTeamTwo: gameFile.goalsTeamTwo,
        goalsTeamOne: gameFile.goalsTeamOne
    };
    
    console.log("check game status is : " + gameFile.isActive);
    //send gamestatus to client.
    res.send(result);
});

// Login requests the player IDs of players logged in to prevent duplicates
app.get('/playerID', /* @callback */ function(req, res){
	gameFile = gameLocation;
	
	var userID = {
		gameisopen: gameFile.isActive,
	    userTeamOneID: gameFile.userTeamOneID,
	    userTeamTwoID: gameFile.userTeamTwoID	    
	};
	
	res.send(userID);
	
});

//Responds with true or false depending on if the game is active.
app.get('/checkgamestatus_ajax', /* @callback */ function(req, res) {
       
    gameFile = gameLocation;
     
    console.log("check game status is : " + gameFile.isActive);
    //send gamestatus to client.
    res.send(gameFile.isActive);
});

//Route to handle goals from the table
app.get('/storeGoals', /* @callback */ function(req, res) {
	
	//Either a 0,1, or 2 are received from the table 
	savegoal = req.query.d;
	if (debug) {
		console.log("Received Signal From Table: " + savegoal);
	}
		
	//1 and 2 are considered goals scored while a 0 is considered a reset.
	if (savegoal === "0") {
		//This is the reset button being pushed
		endGame();
		//vem : why are we starting the game here?
		//startGame();
		if (debug) {
			console.log("Reset button pushed!");
		}
	}
	else {
	
		//NEW Goal Check
		console.log("Savegoal Location: " + location);
        
        //If location is not defined send an error to console
        if(location != undefined){
        	//define gameFile to store game information
            var gameFile = gameLocation;

            console.log("Is the game open?: " + gameFile.isActive);
            //Check if game is already open. information is stored in JSON and locally.
            if(!gameFile.isActive){
				io.sockets.emit("newGameStarted");
				//if no game is open create one 
				console.log("No game is running, open now");
				console.log("Start startgame");
				
				//So as to not overwrite the player data to null values, we check to see if anybody has logged in.
				if(TeamOneLoggedIn === true || TeamTwoLoggedIn === true) {
				gameFile.goalsTeamOne = 0;
				gameFile.isActive = true;
				gameFile.startTime = Date();
				gameFile.timestamp = Date();
				var newGameID = null;
				if (debug)
					console.log("test");
				}
				else {
				gameFile.userTeamOneComp = "";
				gameFile.userTeamTwoComp = "";
				gameFile.userTeamOnePhoto = "";
				gameFile.userTeamTwoPhoto ="";
				gameFile.userTeamOneHead = "";
				gameFile.userTeamTwoHead = "";
				gameFile.userTeamTwoID = "";
				gameFile.userTeamOneID = "";
				gameFile.goalsTeamOne = 0;
				gameFile.goalsTeamTwo = 0;
				gameFile.userTeamTwo = "anonymous";
				gameFile.userTeamOne = "incognito";
				gameFile.isActive = true;
				gameFile.startTime = Date();
				gameFile.timestamp = Date();
				var newGameID = null;  
				}
				
				//Creates a tweet and sends it to node-RED where it will send out the tweet
				tweet = "A game has started between " + gameFile.userTeamOne + " and " + gameFile.userTeamTwo + ". Who will win?";
				 request({
    				url: 'http://austinfoosball-nodered.mybluemix.net/tweet', //URL to hit
   					method: 'POST',
    				body: tweet //Set the body as a string
					}, function(error, response, body){
    					if(error) {
        					console.log("Tweet error: " + error);
				    	} else {
        					console.log(response.statusCode, body);
				    	}
					});
				
				//sendGameData is called to get a new incremented game ID
				sendGameData(newGameID, function(newGameID){
					gameFile.gameID= newGameID;
					console.log(gameFile);
					//uploadJSON(gameFile);
					console.log("This is savegoal before passing it to storeGoals function: " + savegoal);
					//Send to storeGoals to handle the upload
					storeGoals(gameFile, savegoal);
				}); 

			} else {
				//if game is open use gameID to store goal.
				console.log("Got GameID & start insert");
				console.log(savegoal);
				//Send to storeGoals to handle the upload.
				storeGoals(gameFile, savegoal);
			}
		} else {
			console.log("ERR. Savegoal not defined: " + location);
		}
	}
	
	res.send('GET request completed.');
});

///Send league to be displayed on the leaderboard
app.get('/sendleague', /* @callback */ function(req, res) {
	//call function to get data
	getLeaguefromDB(function () {
		console.log('Retrieving league...');
		//send array of objects named league to client via ajax
		res.send(league);
		//Clear the league array so that it can be repopulated again later
		league.data.length = 0; 
		console.log("League array has been emptied");    
	});
});

/* TODO Need to review the function in order to enable this
//Goals by team
app.get('/goalsByTeam', function(req, res) {
        var goalsCollection = {
            goals:
                {
                    //placeholder for teams timestamp 
                    TeamTwo:{
                        "1": { 
                            goalsTeamTwo: 0,
                            timestamp: "Tue Mar 24 2015 10:33:19 GMT+0000 (UTC)"
                        }
                    },
                    TeamOne:{
                        "1": { 
                            goalsTeamOne: 0,
                            timestamp: "Tue Mar 24 2015 10:33:19 GMT+0000 (UTC)"
                        }
                    }
                } 
        };
        
        var goalsArr = [[],[]];
        
        //call function to get data

        getGoalsByTeamfromDB(goalsCollection, function () {
        var TeamTwo = goalsCollection.goals.TeamTwo;
        var TeamOne = goalsCollection.goals.TeamOne;
        var goalsTeamTwo =0;
        var goalsTeamOne =0;
            
        for (var key in TeamTwo) {
            if (TeamTwo.hasOwnProperty(key)) {
                //console.log(TeamTwo[key]);
                var d = Date.parse(TeamTwo[key].timestamp);
                goalsTeamTwo = goalsTeamTwo + TeamTwo[key].goalsTeamTwo;
                goalsArr[0].push([d, goalsTeamTwo]);  
            }
        }
        for (var key in TeamOne) {
            if (TeamOne.hasOwnProperty(key)) {
                var d = Date.parse(TeamOne[key].timestamp);
                goalsTeamOne = goalsTeamOne + TeamOne[key].goalsTeamOne;
                goalsArr[1].push([d, goalsTeamOne]);  
            }
        }    
   
        //console.log(goalsArr);    
        res.send(goalsArr);
        league.data.length = 0;   
        });
});
*/

//Define list to save nemesis player inside
var nemesislist = {
	data: []
};

//Route to handle displaying the nemesis. Very similar to /getLeague
app.get('/getNemesis', /* @callback */ function(req, res) {
	//call function to get data
	getNemesisFromDB(function () {
		console.log('Retrieving nemesis list...');
		//send array of objects named nemesislist to client via ajax
		res.send(nemesislist);
		//Clear the nemesislist array so that it can be populated again later
		nemesislist.data.length = 0; 
		//console.log("empty league array");    
	});
});    


//#########################################################################
//############################# Sockets ###################################
//#########################################################################

//On a successful connection to the client this will happen
io.sockets.on('connection', function(socket){
	
    //Receiving player Data from LinkedIn
    socket.on('profileData', function(member){ 
		gameFile = gameLocation;
		//Remove underscores from data received
        removeUnderscore(member);
        var userName =  (member.firstName +  " " + member.lastName);
        
       //Receive which team logged in from the front end
        switch(member.team){
            case "TeamTwo":
                gameFile.userTeamTwo = userName;        
                gameFile.userTeamTwoPhoto = member.photo;                
                gameFile.userTeamTwoID = member.id;                
                gameFile.userTeamTwoHead = member.headline;                
                gameFile.userTeamTwoComp = member.positions.values[0].company.name;
                TeamTwoLoggedIn = true;
                
                //Send to client userTeamTwo
                io.sockets.emit("LoginPlayerTeamTwo", {userTeamTwo: gameFile.userTeamTwo, userTeamTwoPhoto: gameFile.userTeamTwoPhoto});
                
                //Creates a tweet and sends it to node-RED where it will send out the tweet
                tweet = gameFile.userTeamTwo + " has logged in for Team Two.";
                request({
    				url: 'http://austinfoosball-nodered.mybluemix.net/tweet', //URL to hit
   					method: 'POST',
    				body: tweet //Set the body as a string
					}, function(error, response, body){
    					if(error) {
        					console.log("Tweet error: " + error);
				    	} else {
        					console.log(response.statusCode, body);
				    	}
					});
                break;
            case "TeamOne":
                gameFile.userTeamOne = userName;
                gameFile.userTeamOnePhoto = member.photo;
                gameFile.userTeamOneID = member.id;
                gameFile.userTeamOneHead = member.headline;
                gameFile.userTeamOneComp = member.positions.values[0].company.name;
                TeamOneLoggedIn = true;
                
                //Send to client userTeamTwo
                io.sockets.emit("LoginPlayerTeamOne", {userTeamOne: gameFile.userTeamOne, userTeamOnePhoto: gameFile.userTeamOnePhoto});
                
                //Creates a tweet and sends it to node-RED where it will send out the tweet
                tweet = gameFile.userTeamOne + " has logged in for Team One.";
                 request({
    				url: 'http://austinfoosball-nodered.mybluemix.net/tweet', //URL to hit
   					method: 'POST',
    				body: tweet //Set the body as a string
					}, function(error, response, body){
    					if(error) {
        					console.log("Tweet error: " + error);
				    	} else {
        					console.log(response.statusCode, body);
				    	}
					});
                break;           
        }
        
        console.log(gameFile.userTeamOne + " for TeamOne and " + gameFile.userTeamTwo +" for TeamTwo.");
        
        //Check the database for duplicates 
        db.view('showleague','playerData', function(err,body){ 
            checkDoubles(err, body, member, function(id){
                //console.log("in callback");
                //console.log(id);
               
            });
        });

        //console.log(member);
       
       
    });

});

//Listener for the rematch event. Will create a tweet and send it to Node-RED to be tweeted
io.sockets.on('rematch', function () {
	tweet = "Rematch between " + gameFile.userTeamOne + " and " + gameFile.userTeamTwo +" has started. Who will win?";
	 request({
    				url: 'http://austinfoosball-nodered.mybluemix.net/tweet', //URL to hit
   					method: 'POST',
    				body: tweet //Set the body as a string
					}, function(error, response, body){
    					if(error) {
        					console.log("Tweet error: " + error);
				    	} else {
        					console.log(response.statusCode, body);
				    	}
					});
});
//end of socket.io

//#########################################################################
//############################# Functions #################################
//#########################################################################

//Function that will end the game and emit a GameEnded event to the client
function endGame() {
	gameFile = gameLocation;
	console.log("end Game ");
	console.log(gameFile);
	
	TeamOneLoggedIn = false;
	TeamTwoLoggedIn = false;
	
	//Emit a GameEnded event to the font end
	io.sockets.emit("GameEnded");        
	//Check if game is still running
	if (gameFile.isActive){
		//set status of game to not running therefore false
		gameFile.isActive = false;
		//upload the game json
		//uploadJSON(gameFile);
		//set score of both teams to null for next game
		gameFile.goalsTeamOne = 0;
		gameFile.goalsTeamTwo = 0;
		console.log("Game is active? " + gameFile.isActive);
	} else {
		console.log("No game running");
		gameFile.goalsTeamOne = 0;
		gameFile.goalsTeamTwo = 0;
	}
}

//Open up a new game with name of the both players, location and date. GameID is automatically incremented by one. Save in DB of Cloudant.
function startGame() {
	gameFile = gameLocation;
    //If no game is active/running then create new one
	if (!gameFile.isActive){
		console.log("Start startgame");
		gameFile.goalsTeamOne = 0;
		gameFile.goalsTeamTwo = 0;
		gameFile.isActive = true;
		gameFile.startTime = Date();
		gameFile.timestamp = Date();

		var newGameID = null;  
		//Send to liveticker
		io.sockets.emit("ClickedOnStartButton", {userTeamTwo: gameFile.userTeamTwo, userTeamOne: gameFile.userTeamOne});
		//Save GameID and upload game as JSON to DB.
		sendGameData(newGameID, function(newGameID){
			gameFile.gameID= newGameID;
			console.log(gameFile);
			uploadJSON(gameFile);    
		}); 
	} else {
		console.log("Game already running");
		endGame();
		startGame();
    }
}

//Define storeGoals function
//define team of scorer and send to uploader
//gameFile is of type gameLocation i.e. gameObject
//saveGoal is the JSON parsed message. i.e. the goal count received from IoT
function storeGoals(gameFile, savegoal) {

	var shooter;
	console.log("This is savegoal after being passed to storeGoals function: " + savegoal);
	if (savegoal === "2") { //TODO fix after bootcamp
		gameFile.goalsTeamTwo++;
		shooter = gameFile.userTeamTwo;		
	} else if(savegoal === "1") { //TODO fix after bootcamp
		gameFile.goalsTeamOne++;
		shooter = gameFile.userTeamOne;		
	} else {
		console.log("Error: No team");
    }

	var date = new Date(gameFile.timestamp);
	var hours = date.getHours();
	var minutes = date.getMinutes();
	var time = hours + ":" + minutes;
	//console.log(time);
	//Send goal event to client including the score of both teams and the name of the scorer alias shooter
	console.log(gameFile.goalsTeamTwo + "and" + gameFile.goalsTeamOne);
	io.sockets.emit("goal", { score_TeamTwo: gameFile.goalsTeamTwo, score_TeamOne: gameFile.goalsTeamOne, shooter: shooter, time: time});

	var won = false;

	if (gameFile.goalsTeamTwo === 5) {
		//End game by setting key isActive in json to false
		gameFile.isActive = false;
		console.log(gameFile.userTeamTwo+ " has won");
		won = true;
		io.sockets.emit("gameWon", { score_TeamTwo: gameFile.goalsTeamTwo, score_TeamOne: gameFile.goalsTeamOne, team: 2});
		
		//Generate vitory announcement for teamTwo. Text to speech
		
		objectstring = '{"download":"true","text":"' + gameFile.userTeamTwo +' has won. Yay.","voice":"VoiceEnUsMichael"}'; //change voice to VoiceEnUs
		obj = JSON.parse(objectstring);
		transcript = textToSpeech.synthesize(obj);	
		speechFile = __dirname + "/public/WinningTeam.ogg";
		transcript.pipe(fs.createWriteStream(speechFile)); //saves the file on bluemix server under /home/vcap/app/fileToBePlayedOnPi.ogg. to be pulled by Pi
		transcript.on('end', function() {
		  console.log('***** It\'s saved in ' + speechFile + " ************* ");
		});
		transcript.on('error',console.error);
		//TODO: Issue command to Pi to play "WinningTeam.ogg"
		
		//Creates a tweet and sends it to node-RED where it will send out the tweet
		tweet = gameFile.userTeamTwo + " has won the game. Sorry " + gameFile.userTeamOne + " better luck next time.";
		 request({
    				url: 'http://austinfoosball-nodered.mybluemix.net/tweet', //URL to hit
   					method: 'POST',
    				body: tweet //Set the body as a string
					}, function(error, response, body){
    					if(error) {
        					console.log("Tweet error: " + error);
				    	} else {
        					console.log(response.statusCode, body);
				    	}
					});

	}

    if (gameFile.goalsTeamOne === 5) {
		//team TeamOne won
		//End game by setting key isActive in json to false
		gameFile.isActive = false;
		console.log(gameFile.userTeamOne+" has won");
		won = true;
		io.sockets.emit("gameWon", { score_TeamTwo: gameFile.goalsTeamOne, score_TeamOne: gameFile.goalsTeamOne, team: 1});
		
		//Generate victory announcement for teamOne. Text to speech
		
		objectstring = '{"download":"true","text":" ' + gameFile.userTeamOne + ' has won. Yay. ","voice":"VoiceEnUsMichael"}'; //change voice to VoiceEnUs
		obj = JSON.parse(objectstring);
		transcript = textToSpeech.synthesize(obj);
		speechFile = __dirname + "/public/WinningTeam.ogg";
		transcript.pipe(fs.createWriteStream(speechFile)); //saves the file on bluemix server under /home/vcap/app/fileToBePlayedOnPi.ogg. to be pulled by Pi
		transcript.on('end', function() {
		  console.log('***** It\'s saved in ' + speechFile + " ************* ");
		});
		transcript.on('error',console.error);
		//TODO: Issue command to Pi to play "WinningTeam.ogg"
		
		//Creates a tweet and sends it to node-RED where it will send out the tweet
		tweet = gameFile.userTeamOne + " has won the game. Sorry " + gameFile.userTeamTwo + " better luck next time.";
		 request({
    				url: 'http://austinfoosball-nodered.mybluemix.net/tweet', //URL to hit
   					method: 'POST',
    				body: tweet //Set the body as a string
					}, function(error, response, body){
    					if(error) {
        					console.log("Tweet error: " + error);
				    	} else {
        					console.log(response.statusCode, body);
				    	}
					});

	}

	uploadJSON(gameFile);
	if (won) {
		gameFile.goalsTeamOne = 0;
		gameFile.goalsTeamTwo = 0;
	}
}

//Call function to get GameID and increment it by one. Add this value to GameSheet JSON.
function sendGameData(newGameID, callback) {
	getGameID(function(maxGameID) {
		var gameID = 0;
		gameID = maxGameID;
		console.log("Save MaxGameID: " + gameID + typeof gameID);
		newGameID = ++gameID;
		console.log("Increment GameID: " + newGameID + typeof newGameID);
		console.log("GameID is: " + newGameID);
		callback(newGameID);
	});
}

//Get GameID from DB in cloudant. Give back as Callback.
function getGameID(callback) {
	console.log("start getting GameID");
	//open up the specific view in cloudant, which includes all gameIDs.
	db.view('getgameid','getgameid',function(err, body) {
		console.log("view initialised");
		//check if there is an error
		var maxGameID = 0;
		if (!err) {
			maxGameID = parseInt(body.rows[0].value.max, 10);
			console.log("Highest GameID is: " + maxGameID + typeof maxGameID); 
			//Callback with maxGameID.
			callback(maxGameID);
		} else {
			console.log("error getgameid: " + err);
		}
	});  
}     

//get current timestamp and upload JSON to Cloudant
function uploadJSON(gameFile){
    //get Time stamp
    gameFile.timestamp = Date();
    JSON.stringify(gameFile);
    console.log(gameFile);
    //upload JSON
    db.insert(gameFile, /* @callback */ function(err, body, header){
        if (!err) {
            console.log("Added new JSON");
            }
        else {
            console.log("Error inserting into DB " + err);    
        }
    });
}

//Checks to see if there are any duplicates of player data in th database
function checkDoubles(err, body, member, callback) {
	console.log("view initialised");  
	//check if there is an error
	if (!err) {
		//loop through all rows
		body.rows.forEach(function(doc) {
        	if (debug) {            
				console.log("doc.key: " + doc.key);
                console.log("member.id: " + member.id);
				console.log("doc.id: " + doc.id);
			}
			if(doc.key == member.id) {
				if (debug) {
					console.log("####### DOC KEY MATCH FOUND ########");
					console.log("mem id " + member.id);
					console.log("doc key " + doc.key);
					console.log("doc rev" + doc.value);
					db.destroy(doc.id, doc.value, function(err) {
                    if (!err)
                        console.log("destroyed");
                        
                   	else
                   		console.log(err);
                });
				}				
			}
		});
		 db.insert(member, /* @callback */ function(err, body, header){
            if (!err) {
                console.log("Added user data");
                }
            else {
                console.log("Error inserting into DB " + err);    
            }

        });

	} else {
		console.log("error get linkedin id: " + err);
	}
}


//remove all underscores in LinkedIn user data. Cloudant Sync from BI does not support them yet
function removeUnderscore(member) {    
	_.each(_.allKeys(member), function(val, key){
		//use regex to check if underscore, replace with nothing
		if (val.match(/_/g)) {
			var valNew = val.replace(/_/g,"");
			member[valNew] = member[val];
			delete member[val];
		}
		if (_.isObject(member[val])) {
			//call recursive if a member is an object
			removeUnderscore(member[val]);   
		}
	});
}
        
/**
 * Convert an image 
 * to a base64 url
 * @param  {String}   url         
 * @param  {Function} callback    
 * @param  {String}   [outputFormat=image/png]           
 */
function convertImgToBase64URL(url, callback, outputFormat){
	var canvas = document.createElement('CANVAS'),
    ctx = canvas.getContext('2d'),
	img = new Image();
	img.crossOrigin = 'Anonymous';
	img.onload = function(){
		var dataURL;
		canvas.height = img.height;
		canvas.width = img.width;
		ctx.drawImage(img, 0, 0);
		dataURL = canvas.toDataURL(outputFormat);
		callback(dataURL);
		canvas = null; 
	};
	img.src = url;
}

//GETTING LEAGUE RECORDS
function getLeaguefromDB(callback){
	//console.log("start getting League");
	//open up the specific view in cloudant, which includes all player records
	db.view('showleague','testview',{group: "true"},function(err, body) {
		//console.log("League-View initialised");    
		//check if there is an error
		if (!err) {
			//Loop through the player records
			body.rows.forEach(function(doc) {
				//create new player record for league
				var player = new leagueplayer();    
				player.linkedinID = doc.key[0];
				player.photo = '<img id="playerpic" src =' + doc.key[3] + '></img>';
				player.name = doc.key[1];
				player.company = doc.key[2];
				player.games = doc.value[6];
				player.wins  = doc.value[3];
				player.loses  = doc.value[4];
				player.goalsAndAgainstgoals = doc.value[0] + ":" + doc.value[1];
				player.goaldif =doc.value[2];
				player.points  = doc.value[5];
                
				if (player.name != null 
					& player.goaldif != null 
					& player.name != "incognito" 
					& player.name != "anonymous" ) {
						//add player to league record
						league.data.push(player);
				}
			}); 
		//if done getting league data from cloudant callback with string done
			callback("done");
		} else {
			console.log("error getgameid: " + err);
		}
	});
}

//Define Nemesis Player
function nemesisplayer() {[
	this.name = null,
	this.photo = null,
	this.points = null
];}

//GETTING LEAGUE RECORDS
function getNemesisFromDB(callback){
	//console.log("start getting League");
	//open up the specific view in cloudant, which includes all player records
	console.log("nemesis function started");
	console.log("session id: " + session.uid);
	db.view('individual','getnemesis',{group: "true", startkey: ['"' + session.uid + '"',""]},function(err, body) {
	console.log("Nemesis-View initialised");    
	//check if there is an error
	if (!err) {
		//Loop through the player records
		body.rows.forEach(function(doc) {
			//create new player record for league
			console.log(doc.key[0] + '"' + session.uid + '"' + typeof session.uid + typeof doc.key[0])    
			if(doc.value >= 0 && doc.key[0] ==  session.uid ) {    
				var nemesis = new nemesisplayer();    
				nemesis.name = doc.key[1];
				nemesis.photo = doc.key[2];
				nemesis.value = doc.value;
				//add player to league record
				nemesislist.data.push(nemesis);   
				console.log("drin und nemesislist:" + nemesislist);
			}
		//console.log(nemesis);
		});
		console.log("got nemesis records");
		//if done getting league data from cloudant callback with string done
		callback("done");
		} else {
			console.log("error getgameid: " + err);
		}
	});
}
//########################End Get Nemesis
//###################################################### PROBABILITY
var probTeamOne = new Array();
var probGoalTeamOne;
var probGoalTeamTwo;

//Send probability by ajax
app.get('/getProbability', function(req, res) {
    console.log("Got request for probability");
    //send gamestatus to client.
    handleProbGoals(function(probTeamOne){
         res.send(probTeamOne);
    });
});

//Get all Goals and calculate probability of a goal event for each team
function getProbGoals(callback){
    db.view('wkeit','wkeitgoals',{group: "true",group_level: 1},function(err, body) { 
        if(!err){
            sumallgames = body.rows[0].value + body.rows[1].value;
            probGoalTeamOne = body.rows[0].value / sumallgames;
            probGoalTeamTwo = body.rows[1].value / sumallgames;
            console.log("Success. Got probability vals: " + probGoalTeamTwo + " " + probGoalTeamOne );
            callback(probGoalTeamOne,probGoalTeamTwo);
        } else {
            console.log("Error getting probability total goals: " + err);
            }    
    });
}


//Create probability table.
//This function will handle figuring out the probability of who will win the current game    
function handleProbGoals(callback){
    getProbGoals(function(probGoalTeamOne,probGoalTeamTwo){
        probTeamOne[5] = new Array(1,1,1,1,1,1);
        
        for(var i = 4; i>=0;i--){
            probTeamOne[i] = new Array(0,0,0,0,0,0);
        }
        
        probTeamOne[4][4] = probGoalTeamOne;
          
        for(var i = 3; i>=0;i--){
            index = i + 1;
            probTeamOne[4][i] = probGoalTeamOne*probTeamOne[5][i] + probGoalTeamTwo*probTeamOne[4][index];
            probTeamOne[i][4] = probGoalTeamOne*probTeamOne[index][4] + probGoalTeamTwo*probTeamOne[i][4];
        }
        
        for(var i = 3; i>=0;i--){
            index = i + 1;
            probTeamOne[3][i] = probGoalTeamOne*probTeamOne[4][i] + probGoalTeamTwo*probTeamOne[3][index];
            probTeamOne[2][i] = probGoalTeamOne*probTeamOne[3][i] + probGoalTeamTwo*probTeamOne[2][index];
            probTeamOne[1][i] = probGoalTeamOne*probTeamOne[2][i] + probGoalTeamTwo*probTeamOne[1][index];
            probTeamOne[0][i] = probGoalTeamOne*probTeamOne[1][i] + probGoalTeamTwo*probTeamOne[0][index];
        } 
        console.log("callback: "+probTeamOne);
        callback(probTeamOne);
});   
}

