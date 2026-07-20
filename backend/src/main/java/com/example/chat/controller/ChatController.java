package com.example.chat.controller;

import com.example.chat.model.ChatMessage;
import com.example.chat.repository.ChatMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Controller
@CrossOrigin(originPatterns = "*", allowCredentials = "true") // <--- FIXED: Use originPatterns
public class ChatController {

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private SimpMessageSendingOperations messagingTemplate;

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload ChatMessage chatMessage) {
        // If it's just a typing notification, broadcast it immediately without saving
        // to DB
        if ("TYPING".equals(chatMessage.getType())) {
            messagingTemplate.convertAndSend("/topic/" + chatMessage.getChannel(), chatMessage);
            return;
        }

        if (chatMessage.getTime() == null || chatMessage.getTime().isEmpty()) {
            chatMessage.setTime(LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")));
        }

        // Save actual chat message to Database
        ChatMessage saved = chatMessageRepository.save(chatMessage);

        // Broadcast saved message to channel
        messagingTemplate.convertAndSend("/topic/" + chatMessage.getChannel(), saved);
    }

    @MessageMapping("/chat.editMessage")
    public void editMessage(@Payload ChatMessage chatMessage) {
        if (chatMessage.getId() != null) {
            ChatMessage existing = chatMessageRepository.findById(chatMessage.getId()).orElse(null);
            if (existing != null && !existing.isDeleted()) {
                existing.setContent(chatMessage.getContent());
                existing.setEdited(true);
                chatMessageRepository.save(existing);

                messagingTemplate.convertAndSend("/topic/" + existing.getChannel(), existing);
            }
        }
    }

    @MessageMapping("/chat.deleteMessage")
    public void deleteMessage(@Payload ChatMessage chatMessage) {
        if (chatMessage.getId() != null) {
            ChatMessage existing = chatMessageRepository.findById(chatMessage.getId()).orElse(null);
            if (existing != null) {
                existing.setContent("This message was deleted");
                existing.setDeleted(true);
                chatMessageRepository.save(existing);

                messagingTemplate.convertAndSend("/topic/" + existing.getChannel(), existing);
            }
        }
    }

    @GetMapping("/api/messages/{channel}")
    @ResponseBody
    public List<ChatMessage> getChatHistory(@PathVariable String channel) {
        return chatMessageRepository.findByChannelOrderByIdAsc(channel);
    }
}