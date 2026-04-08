import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-conversation-dashboard',
  imports: [],
  templateUrl: './conversation-dashboard.html',
  styleUrl: './conversation-dashboard.css',
})
export class ConversationDashboard {
constructor(private router:Router){}
  createConversation(){
    console.log("Conversation");
    this.router.navigate(['/c'])
  }
}
