import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import Peer from 'peerjs';
import type { MediaConnection } from 'peerjs';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './video-call.html',
  styleUrl: './video-call.css',
})
export class VideoCall implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('videoStage') videoStage?: ElementRef<HTMLElement>;

  /** Host’s Peer ID — share this as the invite code. */
  hostInviteCode = '';
  guestCodeInput = '';
  inviteEmail = '';
  inviteFromName = '';

  statusLine = '';
  detailLine = '';
  errorLine = '';
  toast = '';

  hostWaiting = false;
  guestDialing = false;
  hasRemote = false;

  /** Keep the call UI (and controls) after the other party leaves until Hang up. */
  private sessionOpen = false;

  micEnabled = true;
  camEnabled = true;
  /** Locally silence everyone else’s audio (1:1: the remote feed). */
  othersAudioMuted = false;

  stageFullscreen = false;

  private peer: InstanceType<typeof Peer> | null = null;
  private mediaCall: MediaConnection | null = null;
  private localStream: MediaStream | null = null;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const invite = this.route.snapshot.queryParamMap.get('invite')?.trim() ?? '';
    if (!invite) {
      return;
    }
    this.guestCodeInput = invite;
    if (this.peer && this.hostInviteCode === invite) {
      return;
    }
    queueMicrotask(() => this.joinAsGuest());
  }

  ngOnDestroy(): void {
    this.hangUp();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    const el = this.videoStage?.nativeElement;
    this.stageFullscreen = !!el && document.fullscreenElement === el;
    this.cdr.detectChanges();
  }

  /** True while host is live and waiting for the first remote stream. */
  get hostSessionBusy(): boolean {
    return !!this.peer && this.hostWaiting && !this.hasRemote;
  }

  /** Show the video stage whenever we have media or an active dial / wait state. */
  get showVideoStage(): boolean {
    return (
      this.hostWaiting ||
      this.hasRemote ||
      this.guestDialing ||
      this.sessionOpen ||
      !!this.localStream
    );
  }

  appJoinUrl(): string {
    const code = this.hostInviteCode.trim();
    if (!code) return '';
    const base = typeof window === 'undefined' ? '' : window.location.origin;
    return `${base}/video?invite=${encodeURIComponent(code)}`;
  }

  inviteMailto(): string {
    const code = this.hostInviteCode.trim();
    const link = this.appJoinUrl();
    const who = (this.inviteFromName || '').trim() || 'Me';
    const subject = encodeURIComponent('Video call invite — Davies');
    const body = encodeURIComponent(
      [
        'Hi,',
        '',
        `I'm inviting you to a quick video call.`,
        '',
        `Your invite code: ${code}`,
        '',
        `Open this link to join (the code may already be filled in):`,
        link,
        '',
        'Use Chrome or Edge if you can, allow camera and microphone when asked.',
        '',
        `— ${who}`,
      ].join('\n'),
    );
    const to = this.inviteEmail.trim();
    return to.length > 0
      ? `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
  }

  async startHosting(): Promise<void> {
    this.clearMessages();
    this.hangUp();
    this.statusLine = 'Creating your room…';

    try {
      this.peer = new Peer({ debug: 0 });
    } catch (e) {
      this.fail(e, 'Could not start PeerJS.');
      return;
    }

    this.peer.on('error', (err) => {
      this.errorLine = err.message || 'Connection error.';
      this.cdr.detectChanges();
    });

    this.peer.on('open', (id) => {
      this.hostInviteCode = id;
      this.hostWaiting = true;
      this.sessionOpen = true;
      this.statusLine = 'Room ready — share your invite code or send an email.';
      this.cdr.detectChanges();
      void this.bindLocalPreview();
    });

    this.peer.on('call', (call) => {
      this.mediaCall = call;
      this.attachCallHandlers(call);
      void this.ensureLocalStream()
        .then((stream: MediaStream) => {
          call.answer(stream);
        })
        .catch((e: unknown) => {
          this.fail(e, 'Camera and microphone are required to answer the call.');
        });
    });
  }

  joinAsGuest(): void {
    const hostId = this.guestCodeInput.trim();
    if (!hostId) {
      this.detailLine = 'Paste the invite code the host sent you.';
      return;
    }

    this.clearMessages();
    this.hangUp();
    this.guestDialing = true;
    this.statusLine = 'Connecting…';

    try {
      this.peer = new Peer({ debug: 0 });
    } catch (e) {
      this.fail(e, 'Could not start PeerJS.');
      return;
    }

    this.peer.on('error', (err) => {
      this.errorLine = err.message || 'Could not reach the host.';
      this.cdr.detectChanges();
    });

    this.peer.on('open', () => {
      this.sessionOpen = true;
      void this.ensureLocalStream()
        .then((stream: MediaStream) => {
          this.showLocal(stream);
          const call = this.peer!.call(hostId, stream);
          if (!call) {
            this.fail(new Error('Call could not start.'), '');
            return;
          }
          this.mediaCall = call;
          this.attachCallHandlers(call);
        })
        .catch((e: unknown) => {
          this.fail(e, 'Camera and microphone are required to join.');
        });
    });
  }

  hangUp(): void {
    this.teardownMedia();
    this.sessionOpen = false;
    this.micEnabled = true;
    this.camEnabled = true;
    this.othersAudioMuted = false;
    this.stageFullscreen = false;
    this.hostInviteCode = '';
    this.hostWaiting = false;
    this.guestDialing = false;
    this.hasRemote = false;
    this.statusLine = '';
    this.detailLine = '';
    this.errorLine = '';
    this.cdr.detectChanges();
  }

  async copyCode(): Promise<void> {
    if (!this.hostInviteCode) return;
    await this.copy(this.hostInviteCode, 'Invite code copied.');
  }

  async copyJoinLink(): Promise<void> {
    const url = this.appJoinUrl();
    if (!url) return;
    await this.copy(url, 'Join link copied.');
  }

  private async copy(text: string, ok: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast = ok;
      this.cdr.detectChanges();
      setTimeout(() => (this.toast = ''), 3200);
    } catch {
      this.toast = 'Select the text and copy manually.';
      this.cdr.detectChanges();
      setTimeout(() => (this.toast = ''), 3200);
    }
  }

  private clearMessages(): void {
    this.errorLine = '';
    this.detailLine = '';
    this.toast = '';
  }

  private fail(err: unknown, fallback: string): void {
    this.sessionOpen = false;
    this.guestDialing = false;
    this.hostWaiting = false;
    this.hostInviteCode = '';
    this.errorLine = err instanceof Error ? err.message : fallback;
    this.statusLine = '';
    this.teardownMedia();
    this.cdr.detectChanges();
  }

  private async bindLocalPreview(): Promise<void> {
    try {
      const stream = await this.ensureLocalStream();
      this.showLocal(stream);
    } catch (e: unknown) {
      this.fail(e, 'Allow camera and microphone to host a call.');
    }
  }

  private async ensureLocalStream(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      return this.localStream;
    } catch {
      throw new Error('Camera or microphone was denied or unavailable.');
    }
  }

  private showLocal(stream: MediaStream): void {
    const el = this.localVideo?.nativeElement;
    if (el) {
      el.srcObject = stream;
      void el.play().catch(() => {});
    }
    this.cdr.detectChanges();
  }

  private attachCallHandlers(call: MediaConnection): void {
    call.on('stream', (remote: MediaStream) => {
      this.hasRemote = true;
      this.guestDialing = false;
      this.sessionOpen = true;
      this.statusLine = 'You’re connected';
      this.detailLine = '';
      const el = this.remoteVideo?.nativeElement;
      queueMicrotask(() => {
        if (el) {
          el.srcObject = remote;
          this.applyOthersAudioMute(el);
          void el.play().catch(() => {});
        }
        const lv = this.localVideo?.nativeElement;
        if (lv && this.localStream) {
          lv.srcObject = this.localStream;
          void lv.play().catch(() => {});
        }
        this.cdr.detectChanges();
      });
    });

    call.on('close', () => {
      this.hasRemote = false;
      this.detailLine = 'The other person left.';
      const el = this.remoteVideo?.nativeElement;
      if (el) el.srcObject = null;
      if (this.hostWaiting) {
        this.statusLine = 'Room ready — waiting for someone to join again.';
      } else {
        this.statusLine = this.localStream
          ? 'You’re still in the call — use the controls or hang up when you’re done.'
          : '';
      }
      this.cdr.detectChanges();
    });
  }

  toggleMic(): void {
    if (!this.localStream) return;
    const audioTracks = this.localStream.getAudioTracks();
    this.micEnabled = !this.micEnabled;
    for (const t of audioTracks) t.enabled = this.micEnabled;
    this.cdr.detectChanges();
  }

  toggleCamera(): void {
    if (!this.localStream) return;
    const videoTracks = this.localStream.getVideoTracks();
    this.camEnabled = !this.camEnabled;
    for (const t of videoTracks) t.enabled = this.camEnabled;
    this.cdr.detectChanges();
  }

  /** Locally mute/unmute all other participants’ audio (remote playback only). */
  toggleMuteOthers(): void {
    this.othersAudioMuted = !this.othersAudioMuted;
    const el = this.remoteVideo?.nativeElement;
    if (el) this.applyOthersAudioMute(el);
    this.cdr.detectChanges();
  }

  async toggleFullscreen(): Promise<void> {
    const el = this.videoStage?.nativeElement;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* ignore — browser may block without gesture */
    }
  }

  private applyOthersAudioMute(videoEl: HTMLVideoElement): void {
    videoEl.muted = this.othersAudioMuted;
    videoEl.volume = this.othersAudioMuted ? 0 : 1;
  }

  private teardownMedia(): void {
    this.mediaCall?.close();
    this.mediaCall = null;
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop();
      this.localStream = null;
    }
    const lv = this.localVideo?.nativeElement;
    if (lv) lv.srcObject = null;
    const rv = this.remoteVideo?.nativeElement;
    if (rv) rv.srcObject = null;
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        /* ignore */
      }
      this.peer = null;
    }
    this.hasRemote = false;
    this.guestDialing = false;
    this.sessionOpen = false;
  }
}
