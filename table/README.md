#Foosbuzz Raspberry Pi Device
The foosbuzz Raspberry Pi device connects to the IBM
Internet of Things Foundation (IOTF) and sends events for
goals scored and whenever the reset button is pressed.

##Services required:
- IBM Internet of Things

After creating a Node-RED application and binding an IOTF
service to it, one will need to create a new device from
inside the IOTF organization dashboard.

The credentials that are provided there need to be placed
on the Raspberry Pi's filesystem, in a file called
/etc/iot/device.cfg

##/etc/iot/device.cfg
    [device]
    org=<unique value>
    type=<unique value>
    id=<unique value>
    auth-method=token
    auth-token=<unique value>
    
There are other requirements for the python code to execute
properly on the Raspberry Pi.

To install these dependency packages into the operating 
system, run the following commands on the Pi:

    $ sudo apt-get update
    $ sudo apt-get install python-pip git
    $ sudo pip install ibmiotf
    $ git clone https://github.com/metachris/RPIO.git
    $ cd RPIO
    $ sudo python setup.py install
    
Next, download the project code from the git repository, 
change the program to be executable, and start it running:

    $ cd /home/pi
    $ git clone https://hub.jazz.net/git/holocron/foosbuzz/
    $ cd foosbuzz/table/my_table
    $ chmod +x table.py
    $ sudo ./table.py
    
The device should check in and start sending events to the
IOTF organization.

You can run the following commands to cause the table.py
program to run automatically at boot time:

    $ sudo echo "sudo /home/pi/foosbuzz/table/my_table/table.py &" >> /etc/rc.local
    $ sudo chmod +x /etc/rc.local
    
    
----
#Virtual Foosbuzz Table
Also, there is a virtual foosbuzz table that simulates exactly
the same behavior as the Raspberry Pi. The code is located in
the virtual_table directory. It can be pushed to Bluemix
as a Python Flask application. Please note the comments in
the code regarding reconfiguring for your particular IOTF 
organization before deploying.
    