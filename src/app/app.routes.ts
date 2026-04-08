import { Routes } from '@angular/router';
import { ConversationDashboard } from '../conversation/conversation-dashboard/conversation-dashboard';
import { Conversation } from '../conversation/conversation';

export const routes: Routes = [
    { path: '', component: ConversationDashboard },
    { path: 'c', component: Conversation },
  
];
