import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  OnDestroy,
  NgZone,
  ChangeDetectorRef
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
export class Conversation implements AfterViewChecked, OnDestroy {

  @ViewChild('chatContent') chatContent!: ElementRef;
  @ViewChild('chatInput') chatInput!: ElementRef<HTMLInputElement>;
  @ViewChild('avatarRef') avatarComponent?: Avatar;
  messages: Message[] = [];
  userMessage: string = '';
  loading: boolean = false;
  lastSpokenIndex = -1;
  enableAiVoice = true;
isChatOpen = false;
isMicMode = false;
private recognition: any = null;
private silenceTimer: ReturnType<typeof setTimeout> | null = null;
private autoSendTimer: ReturnType<typeof setTimeout> | null = null;
private hasSpokenInSession = false;
private isStoppingMic = false;
private readonly SpeechRecognitionCtor =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  constructor(
    private conversationser: ConversationService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  async onSendMessage(showUserBubble = true) {
    if (!this.userMessage.trim()) return;

    const messageText = this.userMessage;
    this.userMessage = '';
    if (showUserBubble) {
      this.ngZone.run(() => {
        this.messages.push({
          text: messageText,
          sender: 'user',
          timestamp: new Date()
        });
        this.cdr.detectChanges();
      });
    }

    this.ngZone.run(() => {
      this.loading = true;
      this.cdr.detectChanges();
    });
    try {
      const response = await this.conversationser.chat(messageText);
      this.ngZone.run(() => {
        this.messages.push({
          text: response,
          sender: 'ai',
          timestamp: new Date()
        });
        this.cdr.detectChanges();
      });
    } catch {
      this.ngZone.run(() => {
        this.messages.push({
          text: 'Error while getting AI response',
          sender: 'ai',
          timestamp: new Date()
        });
        this.cdr.detectChanges();
      });
    } finally {
      this.ngZone.run(() => {
        this.loading = false;
        this.cdr.detectChanges();
      });
      setTimeout(() => {
        this.scrollToBottom();
      });
    }
  }

ngAfterViewChecked() {
  const lastMsgIndex = this.messages.length - 1;

  // scroll to bottom whenever loading or new ai message
  if (this.loading || (lastMsgIndex >= 0 && this.messages[lastMsgIndex].sender === 'ai' && this.lastSpokenIndex !== lastMsgIndex)) {
    requestAnimationFrame(() => {
      this.chatContent?.nativeElement.scrollTo({
        top: this.chatContent.nativeElement.scrollHeight,
        behavior: 'smooth'
      });
    });
  }

  if (
    lastMsgIndex >= 0 &&
    this.messages[lastMsgIndex].sender === 'ai' &&
    this.lastSpokenIndex !== lastMsgIndex
  ) {
    this.lastSpokenIndex = lastMsgIndex;
    if (this.enableAiVoice) {
      this.speakText(this.messages[lastMsgIndex].text);
    }
  }
}
  speakText(text: string) {
    if (this.avatarComponent) {
      this.avatarComponent.speak(text);
      return;
    }

    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'en-IN';
    speech.rate = 1;
    speech.pitch = 1;
    window.speechSynthesis.speak(speech);
  }

openChatInput() {
  this.isChatOpen = !this.isChatOpen;

  setTimeout(() => {
    this.chatInput?.nativeElement?.focus();
  }, 100);
}
toggleMicrophone() {
  if (!this.SpeechRecognitionCtor) {
    alert('Speech recognition is not supported in this browser.');
    return;
  }

  if (this.isMicMode) {
    this.stopMicrophone();
    return;
  }

  this.startMicrophone();
}

private startMicrophone() {
  if (this.loading) return;

  if (!this.recognition) {
    this.recognition = new this.SpeechRecognitionCtor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      this.ngZone.run(() => {
        this.userMessage = transcript.trim();
        this.hasSpokenInSession = this.userMessage.length > 0;
        this.resetSilenceTimer();
        this.scheduleAutoSendAfterPause();
        this.cdr.detectChanges();
      });
    };

    this.recognition.onspeechstart = () => {
      this.ngZone.run(() => {
        this.hasSpokenInSession = true;
        this.resetSilenceTimer();
        this.cdr.detectChanges();
      });
    };

    this.recognition.onspeechend = () => {
      this.ngZone.run(() => {
        this.scheduleAutoSendAfterPause();
        this.cdr.detectChanges();
      });
    };

    this.recognition.onerror = () => {
      this.ngZone.run(() => {
        this.isMicMode = false;
        this.clearMicTimers();
        this.cdr.detectChanges();
      });
    };

    this.recognition.onend = () => {
      this.ngZone.run(() => {
        if (this.isStoppingMic) {
          this.isStoppingMic = false;
          this.cdr.detectChanges();
          return;
        }
        // Some browsers end recognition unexpectedly; restart while mic mode is enabled.
        if (this.isMicMode && !this.loading) {
          this.recognition.start();
        }
        this.cdr.detectChanges();
      });
    };
  }

  this.isMicMode = true;
  this.hasSpokenInSession = false;
  this.clearMicTimers();
  if (!this.isChatOpen) {
    this.openChatInput();
  } else {
    setTimeout(() => {
      this.chatInput?.nativeElement?.focus();
    }, 100);
  }
  this.resetSilenceTimer();
  this.recognition.start();
}

private stopMicrophone(sendIfAny = false) {
  this.isMicMode = false;
  this.clearMicTimers();
  if (sendIfAny && this.userMessage.trim() && !this.loading) {
    this.onSendMessage(true);
  }
  if (this.recognition) {
    this.isStoppingMic = true;
    this.recognition.stop();
  }
}

ngOnDestroy(): void {
  this.stopMicrophone();
}
private resetSilenceTimer() {
  if (this.silenceTimer) {
    clearTimeout(this.silenceTimer);
  }
  // Auto disable if no speech activity for 30 seconds.
  this.silenceTimer = setTimeout(() => {
    this.stopMicrophone(false);
  }, 30000);
}

private scheduleAutoSendAfterPause() {
  if (this.autoSendTimer) {
    clearTimeout(this.autoSendTimer);
  }
  this.autoSendTimer = setTimeout(() => {
    if (!this.isMicMode || !this.hasSpokenInSession) return;
    this.stopMicrophone(true);
  }, 1200);
}

private clearMicTimers() {
  if (this.silenceTimer) {
    clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }
  if (this.autoSendTimer) {
    clearTimeout(this.autoSendTimer);
    this.autoSendTimer = null;
  }
}
private scrollToBottom() {
  try {
    this.chatContent.nativeElement.scrollTo({
      top: this.chatContent.nativeElement.scrollHeight,
      behavior: 'smooth'
    });
  } catch {}
}
}