import { Routes } from '@angular/router';

export const routes: Routes = [
  {
  path: '',
  loadChildren: () => import('../conversation/conversation-module')
    .then(m => m.ConversationModule)
}
];
