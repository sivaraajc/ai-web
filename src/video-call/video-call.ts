import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './video-call.html',
  styleUrl: './video-call.css',
})
export class VideoCall {
  roomId = '';
  inviteEmail = '';
  displayName = '';
  joined = false;
  copyHint = '';
  safeUrl: SafeResourceUrl | null = null;

  constructor(private readonly sanitizer: DomSanitizer) {
    this.roomId = this.generateRoomId();
  }

  generateRoomId(): string {
    const part = () => Math.random().toString(36).slice(2, 7);
    return `davies-${part()}${part()}`;
  }

  sanitizeRoom(raw: string): string {
    const cleaned = raw
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return (cleaned || 'davies-room').slice(0, 64);
  }

  join(): void {
    const room = this.sanitizeRoom(this.roomId);
    this.roomId = room;
    const base = `https://meet.jit.si/${encodeURIComponent(room)}`;
    const name = (this.displayName || 'Guest').trim();
    const url =
      name && name !== 'Guest'
        ? `${base}#userInfo.displayName="${encodeURIComponent(name)}"`
        : base;
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.joined = true;
  }

  leave(): void {
    this.joined = false;
    this.safeUrl = null;
  }

  inviteMailto(): string {
    const room = this.sanitizeRoom(this.roomId);
    const joinUrl = `https://meet.jit.si/${encodeURIComponent(room)}`;
    const subject = encodeURIComponent(`Davies video call — room: ${room}`);
    const body = encodeURIComponent(
      [
        'You are invited to a Davies video call (group calls: share the same room ID).',
        '',
        `Room ID: ${room}`,
        `Join link: ${joinUrl}`,
        '',
        'Open the link in a current browser and allow camera and microphone when prompted.',
      ].join('\n'),
    );
    const email = this.inviteEmail.trim();
    return email.length > 0
      ? `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
  }

  async copyRoomId(): Promise<void> {
    const room = this.sanitizeRoom(this.roomId);
    this.roomId = room;
    try {
      await navigator.clipboard.writeText(room);
      this.copyHint = 'Room ID copied.';
      setTimeout(() => (this.copyHint = ''), 2500);
    } catch {
      this.copyHint = 'Could not copy — select and copy manually.';
      setTimeout(() => (this.copyHint = ''), 3500);
    }
  }
}
