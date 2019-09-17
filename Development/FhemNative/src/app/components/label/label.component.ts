import { Component, Input, OnInit } from '@angular/core';

import { FhemService } from '../../services/fhem.service';
import { SettingsService } from '../../services/settings.service';

@Component({
	selector: 'fhem-label',
	template: `
		<div
			[ngClass]="settings.app.theme"
			class="label"
			double-click
			[editingEnabled]="settings.modes.roomEdit"
			resize
			minimumWidth="60"
			minimumHeight="40"
			id="{{ID}}"
			[ngStyle]="{'width': width, 'height': height, 'top': top, 'left': left, 'z-index': zIndex}">
			<fhem-container [specs]="{'device': data_device, 'reading': data_reading, 'available': true, 'offline': true}">
				<div class="label-container">
					<p
						class="label-item"
						[ngStyle]="{'font-size.px': data_size, 'font-weight': data_fontWeight, 'color': style_color}">
						{{ (fhemDevice ? fhemDevice.readings[data_reading].Value : data_label) }}
					</p>
					<p class="error" *ngIf="!fhemDevice && data_label === ''">
						{{'COMPONENTS.Label.TRANSLATOR.NO_LABEL' | translate}}
						{{'GENERAL.ERRORS.NOT_FOUND.COMPONENT_HELPER' | translate}}
					</p>
				</div>
			</fhem-container>
		</div>
	`,
	styles: [`
		.label{
			position: absolute;
    		width: 60px;
    		height: 40px;
		}
		.label-item{
			width: 100%;
			margin: 0;
			position: absolute;
			top: 50%;
			transform: translate3d(0,-50%,0);
			left: 0;
		}
		.label-container{
			position: absolute;
			width: 100%;
			height: 100%;
			overflow-y: auto;
		}
		.error{
			margin: 8px;
		}
		.dark .error{
			color: var(--dark-p);
		}
	`]
})
export class LabelComponent implements OnInit {

	constructor(private fhem: FhemService, public settings: SettingsService) {}
	// Component ID
	@Input() ID: number;

	@Input() data_device: string;
	@Input() data_reading: string;
	@Input() data_label: string;
	@Input() data_size: string;
	@Input() data_fontWeight: string;

	// Styling
	@Input() style_color = '#86d993';

	// position information
	@Input() width: number;
	@Input() height: number;
	@Input() top: number;
	@Input() left: number;
	@Input() zIndex: number;

	public fhemDevice: any;

	static getSettings() {
		return {
			name: 'Label',
			component: 'LabelComponent',
			type: 'style',
			inputs: [
				{variable: 'data_device', default: ''},
				{variable: 'data_reading', default: ''},
				{variable: 'data_label', default: ''},
				{variable: 'data_size', default: '16'},
				{variable: 'data_fontWeight', default: '300'},
				{variable: 'style_color', default: '#86d993'}
			],
			dimensions: {minX: 60, minY: 40}
		};
	}

	ngOnInit() {
		this.fhem.getDevice(this.data_device, this.data_reading).then((device) => {
			this.fhemDevice = device;
		});
	}
}