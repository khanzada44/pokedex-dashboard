import { Component } from '@angular/core';
import { MaterialModule } from '../../shared/material/material-module';

@Component({
  selector: 'app-sidebar',
  imports: [MaterialModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {}
