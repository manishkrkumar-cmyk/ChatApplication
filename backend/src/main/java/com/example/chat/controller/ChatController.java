package com.example.chat.controller;

import com.example.chat.model.ChatMessage;
import com.example.chat.repository.ChatMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Controller
@CrossOrigin(origins = "*")
public class ChatController {

    @Autowired
    private ChatMessageRepository repository;

    @MessageMapping("/chat.sendMessage/{channel}")
    @SendTo("/topic/{channel}")
    public ChatMessage sendMessage(@DestinationVariable String channel, @Payload ChatMessage chatMessage) {
        chatMessage.setChannel(channel);
        return repository.save(chatMessage);
    }

    @MessageMapping("/chat.addUser/{channel}")
    @SendTo("/topic/{channel}")
    public ChatMessage addUser(@DestinationVariable String channel, @Payload ChatMessage chatMessage) {
        chatMessage.setChannel(channel);
        return chatMessage;
    }

    @GetMapping("/api/messages/{channel}")
    @ResponseBody
    public List<ChatMessage> getChannelHistory(@PathVariable String channel) {
        return repository.findByChannelOrderByIdAsc(channel);
    }
}