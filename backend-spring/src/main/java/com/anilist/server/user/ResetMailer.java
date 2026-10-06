package com.anilist.server.user;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class ResetMailer {
    private final ObjectProvider<JavaMailSender> sender;
    private final String clientUrl;
    private final String from;
    public ResetMailer(ObjectProvider<JavaMailSender> sender, @Value("${app.client-url:}") String clientUrl,
                       @Value("${spring.mail.username:}") String from) {
        this.sender = sender; this.clientUrl = clientUrl; this.from = from;
    }
    public void send(String email, String token) {
        JavaMailSender mail = sender.getIfAvailable();
        if (mail == null || clientUrl.isBlank() || from.isBlank()) throw new IllegalStateException("Mail is not configured");
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from); message.setTo(email); message.setSubject("비밀번호 재설정 안내");
        message.setText("아래 링크에서 비밀번호를 재설정하세요. (10분간 유효)\n"
                + clientUrl.replaceAll("/+$", "") + "/user/reset-password?token=" + token);
        mail.send(message);
    }
}
