---
title: Auto email script
date: 2024-02-08 00:00:01 +500
categories: [Code, tool]
tags: [tool]
---
This is a python script that send email automatically. To use this script, you need to setup an app password for your gmail, following this [tutorial](https://support.google.com/accounts/answer/185833).<br /> 
An example:
```
send_email(sender='sender@gmail.com', app_password='xxxxxxxxxx', receivers='receiver@icloud.com',
           text_header='这个是主题', text_body='this is the body', img_dir='./dark.png')
```
The `send_email` function can take text and image directory as input. Image directory could be either local path or an url. 

The source code:
```
# -*- coding: utf-8 -*-
# !/usr/bin/python
# -*- coding: UTF-8 -*-

import smtplib
from email import encoders
from email.header import Header
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.utils import parseaddr, formataddr
from PIL import Image
import requests
from io import BytesIO

def add_image(image_file):
    if image_file.startswith('http://') or image_file.startswith('https://'):
        response = requests.get(image_file)
        return response.content
    else:
        image = open(image_file, 'rb')
        image_out = image.read()
        image.close()
        return image_out

def _format_addr(s):
    name, addr = parseaddr(s)
    return formataddr((Header(name, 'utf-8').encode(),
                       addr.encode('utf-8') if isinstance(addr, bytes) else addr))

def send_email(sender, app_password, receiver, text_header, text_body='', img_dir=None):

    mail_host = 'smtp.gmail.com'

    message = MIMEMultipart()
    message.attach(MIMEText(text_body, 'plain', 'utf-8'))
    message['From'] = _format_addr('<%s>' % sender)
    message['To'] = _format_addr('<%s>' % receiver)
    message['Subject'] = Header(text_header, 'utf-8').encode()

    if img_dir is not None:
        img = add_image(img_dir)
        msgImage = MIMEImage(img)
        message.attach(msgImage)

    try:
        server = smtplib.SMTP_SSL(mail_host, 465)
        server.ehlo()
        server.login(sender, app_password)
        server.sendmail(sender, receiver, message.as_string())
        server.close()
        # print("email send successfully")
    except smtplib.SMTPException:
        print("Error: failed to send")
```
