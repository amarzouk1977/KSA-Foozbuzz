#!/usr/bin/python

import RPIO
from time import sleep
import signal
import sys
import logging
from iotClient import iotClient


def main_function():

  # setup iot device connection
  configFilePath = "/etc/iot/device.cfg"
  table = iotClient(configFilePath)
  table.connect()
  table.client.logger.setLevel(logging.INFO)

  # setup sensor input pins
  inputPin1 = 14 #GPIO14, Board 8
  inputPin2 = 15 #GPIO15, Board 10
  inputButtonPin = 18 #GPIO18, Board12

  # setup SIGINT handler
  def signal_handler(signal, frame):
    print '\nExiting.'
    RPIO.cleanup()
    sys.exit(0)
  signal.signal(signal.SIGINT, signal_handler)

  # setup callbacks for sensors
  def sensor1_callback(gpio_id, value):
    table.client.logger.info("Gooooal!! Sensor 1.")
    table.send(1)
    sleep(2)

  def sensor2_callback(gpio_id, value):
    table.client.logger.info("Gooooal!! Sensor 2.")
    table.send(2)
    sleep(2)

  def button_callback(gpio_id, value):
    table.client.logger.info("RESET BUTTON PRESSED.")
    table.send(0)

  # enable the interrupt callback for both sensors
  # http://pythonhosted.org/RPIO/rpio_py.html#gpio-interrupts
  RPIO.add_interrupt_callback(inputPin1, 
                              sensor1_callback,
                              edge='falling',
                              threaded_callback=False)
#                              debounce_timeout_ms=1000)

  RPIO.add_interrupt_callback(inputPin2,
                              sensor2_callback,
                              edge='falling',
                              threaded_callback=False)
#                              debounce_timeout_ms=1000)
                       

  RPIO.add_interrupt_callback(inputButtonPin,
                              button_callback,
                              edge='falling',
                              threaded_callback=False,
                              pull_up_down=RPIO.PUD_UP,
                              debounce_timeout_ms=500)

  # main blocking loop, listens for interrupts and 
  # starts custom callbacks, threaded=False loops forever in foreground
  RPIO.wait_for_interrupts(threaded=False)

#  while True:
    #this loops forever too, not needed if threaded=False in RPIO.wait_for_interrupts
#    signal.pause()

if __name__ == "__main__":
  main_function()
