#Foosbuzz
##A Bluemix enabled foosball game

This project contains three separate applications code bases.
All three projects need to be deployed to successfully enable 
connected foosbuzz table.

Each application code base is contained in a subfolder, see 
README.md file in each subfolder for more information
about how to deploy successfully.

### /table :
Conains a small python project that is to be executed on a
Raspberry Pi. Used to send goal and game reset button events
to an IBM IOT Foundation organization.

### /node-red :
Contains node-RED flow that connects to the IOT Foundation
organization and the node.js server. Handles twitter logic
and other things.

### /server :
Contains node.js application that serves the browser app, and
communicates with the node-red flow.