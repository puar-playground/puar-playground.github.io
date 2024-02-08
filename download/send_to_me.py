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

def _format_addr(s):
    name, addr = parseaddr(s)
    return formataddr((Header(name, 'utf-8').encode(),
                       addr.encode('utf-8') if isinstance(addr, bytes) else addr))

def send_result(sender_gmail, receiver_emails, text_header, text_body, img_dir):

    mail_host = 'smtp.gmail.com'
    gmail_user = 'cjvault1223@gmail.com'  # email address used to send
    gmail_password = 'xxxxxxxxxxxxxx'  # # app password 

    sender = 'cjvault1223@gmail.com' # email address used to send
    receivers = ['cjcobalt@icloud.com']  # email address of the receiver 

    # 三个参数：第一个为文本内容，第二个 plain 设置文本格式，第三个 utf-8 设置编码
    message = MIMEMultipart()
    message.attach(MIMEText(text_body, 'plain', 'utf-8'))
    message['From'] = _format_addr('<%s>' % sender)
    message['To'] = _format_addr('<%s>' % receivers[0])
    message['Subject'] = Header(text_header, 'utf-8').encode()

    img = open(img_dir, 'rb')
    msgImage = MIMEImage(img.read())
    img.close()
    message.attach(msgImage)

    try:
        server = smtplib.SMTP_SSL(mail_host, 465)
        server.ehlo()
        server.login(gmail_user, gmail_password)
        server.sendmail(sender, receivers, message.as_string())
        server.close()
        # print("email send successfully")
    except smtplib.SMTPException:
        print("Error: failed to send")


if __name__ == "__main__":
    maxacc = 93
    ep = 2
    acc = 88
    send_result('Hello world', ep, acc, maxacc)
