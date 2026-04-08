import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { Conversation } from './conversation';
import { ConversationDashboard } from './conversation-dashboard/conversation-dashboard';

const routes: Routes = [
  { path: '', component: ConversationDashboard },
  { path: 'c', component: Conversation },
];

@NgModule({
  declarations: [],
  imports: [CommonModule,RouterModule.forChild(routes) ],
})
export class ConversationModule {}
