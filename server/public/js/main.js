// I. socket.io for communicationg between client and server
// II. LinkedIn login functions called by index.ejs\
// III. Main page actions and event handling
// I. CONNECT TO SOCKET.IO /////////////////////////////////////////////////////////////////////////////
var socket = io.connect();

// You will need to know which sensor maps to which team color. In this example Team One is Black and Team Two is Yellow.
var team1 = 'Yellow'; //TODO Change to match your Team One color
var team2 = 'Black'; //TODO Change to match your Team Two color

// II. Login to LinkedIn ///////////////////////////////////////////////////////////////////////////////
//Begin the LinkedIN functions /////////////////////////////
var selected = 1;

// Declare user information variables
var userOne;
var userTwo;

var userOnePhoto;
var userTwoPhoto;

var memberOne;
var memberTwo;

var playersloggedin = 0;

// Function is not used.  Describes actions after login. TODO remove when testing is done
function onLinkedInLogin() {

}

// On loading LinkedIn auth, get profile data. Initiated from EJS pages. 
function onLinkedInLoad() {
    IN.Event.on(IN, "auth", getProfileData);
}

function LinkedINAuth() {
    IN.UI.Authorize().place();
}

// Initiates the LinkedIn login modal
function popup() {
    LinkedINAuth();
    IN.Event.on(IN, "auth", function() {
        onLinkedInLogin();
    });
}

// Get high resolution image from linkedin TODO Not used
function highRes(images) {
    img = images.values[0];
    onSuccess();
}

//Get Profile Data from LinkedIn Account
function onSuccess(data) {

    var member = data.values[0];

    //Variables declared for testing
    var id = member.id;
    var firstName = member.firstName;
    var lastName = member.lastName;
    var photo;

    //Check to see if already assigned
    $.get('/playerID', function(res) {
        var userTeamOneID = res.userTeamOneID;
        var userTeamTwoID = res.userTeamTwoID;
        
        var gameisopen = res.gameisopen;

        if (gameisopen) {

        	if (id == userTeamOneID || id == userTeamTwoID) {
            	alert("Already logged in as a captain. You can't play yourself");
            }
            
        } else {

            //If no picture give them the anonymous photo, else pick first photo   	
            if (member.pictureUrls.values == undefined || member.pictureUrls.values == null) {
                photo = "../images/no_avatar.png";
            } else {
                photo = member.pictureUrls.values[0];
            }

            //Test to see if getting any linkedIn data
            console.log('ID:         ' + id);
            console.log('FirstName:  ' + firstName);
            console.log('LastName:   ' + lastName);
            console.log('Photo:      ' + photo);

            // Selected Team One Login
            if (selected === 1) {
                //Load HTML elements with user data
                $("#nameOne").html(firstName + ' ' + lastName);
                $("#imageOne").attr("src", photo);
                $('#LoginButtonOne').hide();

                //Load member for server 
                memberOne = member;
                memberOne.team = "TeamOne";
                memberOne.photo = photo;

                //TODO these two lines can probably go
                //userOne = (firstName + " " + lastName);
                //userOnePhoto = photo;

                //Send data to server
                socket.emit('profileData', memberOne);

                //Add one to the players logged in
                playersloggedin++;
            }
            //Selected Team Two Login
            else if (selected === 2) {
                //Load HTML elements with user data
                $("#nameTwo").html(firstName + ' ' + lastName);
                $("#imageTwo").attr("src", photo);
                $('#LoginButtonTwo').hide();

                //Load member to send to the server
                memberTwo = member;
                memberTwo.team = "TeamTwo";
                memberTwo.photo = photo;

                //TODO I assume these are here so they can be called later, verify
                //userTwo = (firstName + " " + lastName);
                //userTwoPhoto = photo;

                //Send data to server
                socket.emit('profileData', memberTwo);

                //Add a player to logged in count
                playersloggedin++;
            }

            //If both players are logged in, give possibility to start game
            if (playersloggedin === 2) {

                $(document).ready(function() {
                    timeline_data.push({
                        date: currentDate,
                        title: 'Captains Ready!',
                        content: 'Both teams are logged in. Start playing!'
                    });
                    reloadTimeline();
                });
            }

            //Log out of LinkedIn
            IN.User.logout();
        }
    });
}

//Log the error
function onError(error) {
    console.log(error);
}

//Getting specific profile data from LinkedIn
function getProfileData() {
    IN.API.Profile("me").fields(["id", "firstName", "lastName", "location", "industry", "picture-urls::(original)", "headline", "positions:(is-current,company:(name))"]).result(onSuccess).error(onError);
}

//Button handling for client login
$(document).ready(function() {
    // When the Login button for team One is clicked, initiate LinkedIn login and set the team to 1
    $("#LoginButtonOne").click(function() {
        selected = 1;
        popup();
    });

    // When the login button for team Two is clicked, initiate LinkedIn login and set the team to 2
    $("#LoginButtonTwo").click(function() {
        selected = 2;
        popup();
    });
});

// III. Main page rendering ////////////////////////////////////////////////////////////////////////////

//Encapsulate all load functions
$(document).ready(function() {

    //Disable reset game on page load
    $("#end").hide();
    $("#rematch").hide();

    //Declare variables
    var currentDate = new Date();
    var servOne;
    var servTwo;
    var team;
    var gameisopen;
    
    //variable for probability
	var probTeamOne;

    //Initiate first element in timeline
    timeline_data = [{
        date: new Date(),
        title: ' ',
        content: 'Welcome to Foosbuzz, powered by Bluemix!'
    }];
    reloadTimeline();

    //Get element ID for team points
    var $Two = $("#Two-score");
    var $One = $("#One-score");

    //Get initial probability	
    $.get('/getProbability', function(res) {
        probTeamOne = res;
    });

    //Check if a game is open. If it is load the page with the user's data. 
    $.get('/statuscheck', function(res) {
        //Same game status from server to client variable
        gameisopen = res.gameisopen;

        if (gameisopen) {
            //There are players logged in
            $("#nameOne").html(res.userTeamOne);
            $("#imageOne").attr("src", res.userTeamOnePhoto);
            $One.val(res.goalsTeamOne);
            $('#LoginButtonOne').hide();
            $("#nameTwo").html(res.userTeamTwo);
            $("#imageTwo").attr("src", res.userTeamTwoPhoto);
            $Two.val(res.goalsTeamTwo);
            $('#LoginButtonTwo').hide();
            
            goalOne = res.goalsTeamOne;
            goalTwo = res.goalsTeamTwo;
            
            //Get initial probability	
    		$.get('/getProbability', function(res) {
        		probTeamOne = res;
        		console.log("Probability Team One: "+probTeamOne);
        		
        		//Show probability
        		if (probTeamOne == null) {
            		console.log("probability is undefined");
       			} else {
            		$('#probTeamOne').html((probTeamOne[goalOne][goalTwo] * 100).toFixed(1) + "%");
            		$('#probTeamTwo').html(((1 - probTeamOne[goalOne][goalTwo]) * 100).toFixed(1) + "%");
                	$('.probval').show();
        		}
    		});
           

            //Player One is not logged in, set to defaults
            if (res.userTeamOne === "anonymous" || res.userTeamOne === "incognito") {
                userDefault(team1, "One");
                $One.val(res.goalsTeamOne);

            }
            //Player Two is not logged in, set to defaults
            if (res.userTeamTwo === "anonymous" || res.userTeamTwo === "incognito") {
                userDefault(team2, "Two");
                $Two.val(res.goalsTeamTwo);
            }

        } else {
            userDefault(team1, "One");
            userDefault(team2, "Two");
            $One.val(0);
            $Two.val(0);
        }
        
    });

    //Browser button events	//////////////////////////////////////////////////////////////  
    //End button in browser hit
    $("#end").click(function() {
        gameEnd();
    });

    //Rematch button hit, act like a game start without resetting users TODO Emit same players? 
    $("#rematch").click(function() {
        //Disable reset game
        $("#end").show();
        $("#rematch").hide();
        
        socket.emit("rematch");

        $.get('/startGame', function() {});

        gameStart();
    });

    //SOCKET EVENTS	//////////////////////////////////////////////////////////////////////////////
    //Received goal from server, determine which team scored and save shooter 
    socket.on("goal", function(data) {
        servOne = data.score_TeamOne;
        servTwo = data.score_TeamTwo;
        shooter = data.shooter;

        $("#end").show();

        if (servTwo > $Two.val()) {
            team = team2;
        }

        if (servOne > $One.val()) {
            team = team1;
        }
        
        //Show probability
        if (probTeamOne == null) {
            console.log("probability is undefined");
        } else {
        	console.log('Probability Team One: '+probTeamOne);
            $('#probTeamOne').html((probTeamOne[data.score_TeamOne][data.score_TeamTwo] * 100).toFixed(1) + "%");
            $('#probTeamTwo').html(((1 - probTeamOne[data.score_TeamOne][data.score_TeamTwo]) * 100).toFixed(1) + "%");
            if (gameisopen) {
                $('.probval').show();
            }
        }

        goalScored(team, shooter, servOne, servTwo);
    });

    //Received game won event from server, display winner
    socket.on("gameWon", function(data) {
        $One.val(data.score_TeamOne);
        $Two.val(data.score_TeamTwo);


        if (data.team === 1) {
            gameWin(team1);
        }

        if (data.team === 2) {
            gameWin(team2);
        }

    });
    
    //Reset button hit
    socket.on("GameEnded", function() {
    	$("#end").hide();
        $("#rematch").hide();
        $(".probval").hide();

        //reset Team One to defaults
        userDefault(team1, "One");
        userOne = "Captain " + team1;
        $One.val(0);
        memberOne = null;

        //reset Team Two to defaults
        userDefault(team2, "Two");
        userTwo = "Captain " + team2;
        $Two.val(0);
        memberTwo = null;

        //Report game over
        timeline_data.push({
            date: new Date(),
            title: 'Game End',
            content: 'Game reset. Log in to play.'
        });
        reloadTimeline();
    	
    });

    //Emitted from server after a game start, team captains are passed into a timeline event TODO Remove
    socket.on('ClickedOnStartButton', function(data) {
        gameStart();
        timeline_data.push({
            date: currentDate,
            title: 'Captains Ready!',
            content: 'Captain for Team ' + team1 + ', ' + data.userTeamOne + ' faces off against ' + team2 + ' Captain, ' + data.userTeamTwo
        });
        reloadTimeline();
    });

    //Tweet received for Team One TODO Does this even work yet?
    socket.on("tweetr", function(data) {
        timeline_data.push({
            date: currentDate,
            title: '<i class="fa fa-twitter fa-lg"></i>Tweet for team' + team1,
            content: '<i class="glyphicon glyphicon-time"></i> @<b>' + data.tweet.user.screen_name + '</b>: "' + data.tweet.text
        });
        reloadTimeline();
    });

    //Tweet received for Team Two TODO Does this event work yet?
    socket.on("tweetb", function(data) {
        timeline_data.push({
            date: currentDate,
            title: '<i class="fa fa-twitter fa-lg"></i>Tweet for team' + team2,
            content: '<i class="glyphicon glyphicon-time"></i> @<b>' + data.tweet.user.screen_name + '</b>: "' + data.tweet.text
        });
        reloadTimeline();
    });

    //Player One has logged in, load attributes of player if an actual person
    socket.on('LoginPlayerTeamOne', function(data) {
        if (data.userTeamOne !== 'incognito' || data.userTeamOne !== 'anonymous' || date.userTeamOne !== null) {
            userOne = data.userTeamOne;
            userOnePhoto = data.userTeamOnePhoto;
            $("#nameOne").html(userOne);
            $("#imageOne").attr("src", userOnePhoto);
            //Hide login button to prevent others from logging in
            $('#LoginButtonOne').hide();

            timeline_data.push({
                date: new Date(),
                title: 'Team ' + team1 + ' Logged In',
                content: data.userTeamOne + ' playing for Team ' + team1
            });
            reloadTimeline();
        }
    });

    //Player Two has logged in, load attributes of player if an actual person
    socket.on('LoginPlayerTeamTwo', function(data) {
        if (data.userTeamTwo !== 'anonymous' || data.userTeamTwo !== 'incognito' || date.userTeamTwo !== null) {
            userTwo = data.userTeamTwo;
            userTwoPhoto = data.userTeamTwoPhoto;
            $("#nameTwo").html(userTwo);
            $("#imageTwo").attr("src", userTwoPhoto);
            //Hide login button to prevent others from logging in
            $('#LoginButtonTwo').hide();

            timeline_data.push({
                date: new Date(),
                title: 'Team ' + team2 + ' Logged In',
                content: data.userTeamTwo + ' playing for Team ' + team2
            });
            reloadTimeline();
        }
    });


    //COMMONLY USED FUNCTIONS ////////////////////////////////////////////////////////////
    //Game is started either in browser or on the foosball table
    function gameStart() {
        $Two.val(0);
        $One.val(0);

        $("#end").show();

        //Report game start
        timeline_data.push({
            date: currentDate,
            title: 'Game Started!',
            content: 'A game has started, who will win? ' + team1 + ' or ' + team2 + '? Tweet your favorite team.'
        });
        reloadTimeline();
    }

    //Game won
    function gameWin(team) {
        $("#rematch").show();
        $("#end").show();

        //Report winner
        timeline_data.push({
            date: new Date(),
            title: 'Team ' + team + ' Wins!',
            content: 'Team ' + team + ' wins! Game over. Rematch?'
        });
        reloadTimeline();
    }

    //Game ended, reset all page variables to default and simulate logout
    function gameEnd() {
        $("#end").hide();
        $("#rematch").hide();
        $(".probval").hide();

        //reset Team One to defaults
        userDefault(team1, "One");
        userOne = "Captain " + team1;
        $One.val(0);
        memberOne = null;

        //reset Team Two to defaults
        userDefault(team2, "Two");
        userTwo = "Captain " + team2;
        $Two.val(0);
        memberTwo = null;

        //Report game over
        timeline_data.push({
            date: new Date(),
            title: 'Game End',
            content: 'The game is over.  Login to kick off a new game.'
        });
        reloadTimeline();

        $.get('/endGame', function() {});
        $.get('/getProbability', function(res){
        	console.log("probability update event fired"); 
            probTeamOne = res;
            });       

        //TODO Remove later
        console.log("Game ended.");
    }

    //Handle all goal scoring events
    function goalScored(team, shooter, servOne, servTwo) {
        $One.val(servOne);
        $Two.val(servTwo);

        //Display timeline event with shooter's name
        if (shooter != undefined) {
            timeline_data.push({
                date: new Date(),
                title: 'Goal!',
                content: "Team " + team + " Captain " + shooter + " scores!"
            });
            reloadTimeline();
        } else {
            //Report new score 
            timeline_data.push({
                date: new Date(),
                title: 'Goal!',
                content: team + ' team scores!'
            });
            reloadTimeline();
        }
    }

    //Set default parameters for each team
    function userDefault(team, text) {
        $("#name" + text).html("Captain " + team);
        $("#image" + text).attr("src", 'images/noavatar.png');
        $('#LoginButton' + text).show();
    }

    //Setup for all new timeline events
    function reloadTimeline() {
        $("#timeline").load('index.ejs #timeline', function() {
            timeline = new Timeline($('#timeline'), timeline_data);
            timeline.display();
        });
    }

});