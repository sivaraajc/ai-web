import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewChecked
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConversationService } from '../service/conversation-service';
import { Avatar } from "../avatar/avatar";
import { MatIconModule } from '@angular/material/icon';
interface Message {
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

@Component({
  selector: 'app-conversation',
  standalone: true,
  templateUrl: './conversation.html',
  styleUrls: ['./conversation.css'],
  imports: [FormsModule, CommonModule, Avatar, MatIconModule], 
})
export class Conversation implements AfterViewChecked {

  @ViewChild('chatContent') chatContent!: ElementRef;
  @ViewChild('chatInput') chatInput!: ElementRef<HTMLInputElement>;
  messages: Message[] = [];
  userMessage: string = '';
  loading: boolean = false;
  lastSpokenIndex = -1;
isChatOpen = false;
isMicMode = false;
  constructor(private conversationser: ConversationService) {}

  async onSendMessage() {
    if (!this.userMessage.trim()) return;

    this.messages.push({
      text: this.userMessage,
      sender: 'user',
      timestamp: new Date()
    });

    const messageText = this.userMessage;
    this.userMessage = '';

    this.loading = true;

    const response = await this.conversationser.chat(messageText);

    this.loading = false;

    this.messages.push({
      text: response,
      sender: 'ai',
      timestamp: new Date()
    });
  }

 ngAfterViewChecked() {
  const lastMsgIndex = this.messages.length - 1;

  if (
    lastMsgIndex >= 0 &&
    this.messages[lastMsgIndex].sender === 'ai' &&
    this.lastSpokenIndex !== lastMsgIndex
  ) {
    this.lastSpokenIndex = lastMsgIndex;

    this.speakText(this.messages[lastMsgIndex].text);

    requestAnimationFrame(() => {
      this.chatContent?.nativeElement.scrollTo({
        top: this.chatContent.nativeElement.scrollHeight,
        behavior: 'smooth'
      });
    });
  }
}

  speakText(text: string) {
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'en-IN';
    speech.rate = 1;
    speech.pitch = 1;

    window.speechSynthesis.speak(speech);
  }

openChatInput() {
  this.isChatOpen = true;

  setTimeout(() => {
    this.chatInput?.nativeElement?.focus();
  }, 100);
}
toggleMicrophone() {
  this.isMicMode = !this.isMicMode;
}
}