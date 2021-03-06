import { Component, OnInit, NgModule } from '@angular/core';
import { ModalController, Platform } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

// interfaces
import { FhemDevice, DynamicComponent, DynamicComponentDefinition } from '../../interfaces/interfaces.type';

// Components
import { IonicModule } from '@ionic/angular';
import { ComponentsModule } from '../components.module';

// Services
import { FhemService } from '../../services/fhem.service';
import { StructureService } from '../../services/structure.service';
import { SettingsService } from '../../services/settings.service';
import { VersionService } from '../../services/version.service';
import { BackButtonService } from '../../services/back-button.service';
import { FileManagerService } from '../../services/file-manager.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { TaskService } from '../../services/task.service';
import { LoggerService } from '../../services/logger/logger.service';
import { NativeFunctionsService } from '../../services/native-functions.service';
import { ComponentLoaderService } from '../../services/component-loader.service';

// Translator
import { TranslateService } from '@ngx-translate/core';

// Plugins
import { SocialSharing } from '@ionic-native/social-sharing/ngx';

@Component({
	selector: 'settings',
	templateUrl: './settings.component.html',
  	styleUrls: ['./settings.component.scss']
})

export class SettingsComponent implements OnInit {
	// Back button handle ID
	private handleID: string = '_' + Math.random().toString(36).substr(2, 9);

	// picker states
	menus: {[key: string]: boolean} = {
		customAppTheme: false,
		changeLog: false,
		thirdParty: false,
		advanced: false
	};

	// is desktop
	onDesktop: boolean;
	// device sizes for rescale
	devices: Array<{device: string, dimensions: {width: number, height: number}}> = []; 

	// changelog data
	changelog: any;

	constructor(
		public settings: SettingsService,
		public translate: TranslateService,
		public native: NativeFunctionsService,
		public version: VersionService,
		private modalCtrl: ModalController,
		private fhem: FhemService,
		private structure: StructureService,
		private backBtn: BackButtonService,
		private fileManager: FileManagerService,
		private componentLoader: ComponentLoaderService,
		private storage: StorageService,
		private toast: ToastService,
		private task: TaskService,
		private http: HttpClient,
		private platform: Platform,
		private logger: LoggerService,
		private socialSharing: SocialSharing){
	}

	ngOnInit(){
		// assign back button
		this.backBtn.handle(this.handleID, ()=>{
			this.closeSettings();
		});
		// check platform
		this.onDesktop = this.platform.is('electron');
	}

	// edit websocket settings
	toggleConnectionSettings(){
		this.settings.modes.fhemMenuMode  = 'ip-config';
		this.closeSettings();
	}

	// share settings
	share(varaint: string) {
		this.storage.getAllSettings().then((res: any) => {
			this.fileManager.writeFile('FhemNative_settings.json', JSON.stringify(res)).then((data: any)=>{
				if (varaint === 'local') {
					this.toast.showAlert(
						this.translate.instant('GENERAL.DICTIONARY.SETTINGS_SAVED_TITLE'),
						this.translate.instant('GENERAL.DICTIONARY.SETTINGS_SAVED_INFO') + data.dir + '/' + data.name,
						false
					);
				}else{
					if (this.platform.is('mobile')) {
						this.socialSharing.share(
							this.translate.instant('GENERAL.SETTINGS.FHEM.EXPORT.MESSAGES.SHARE.TITLE'),
							this.translate.instant('GENERAL.SETTINGS.FHEM.EXPORT.MESSAGES.SHARE.INFO'),
							data.dir + '/FhemNative_settings.json'
						);
					} else{
						const mail = 'mailto:?subject=' +
							this.translate.instant('GENERAL.SETTINGS.FHEM.EXPORT.MESSAGES.SHARE.TITLE') + '&body=' +
							this.translate.instant('GENERAL.SETTINGS.FHEM.EXPORT.MESSAGES.SHARE.INFO') + '. ' + data.dir;
    					window.location.href = mail;
					}
				}
			}).catch((err) => {
				throw new Error(this.translate.instant('GENERAL.SETTINGS.FHEM.EXPORT.MESSAGES.DIRECTORY'));
			});
		});
	}

	// share log file
	shareLog(varaint: string){
		this.fileManager.writeFile('FhemNative_Log_Export.json', JSON.stringify(this.settings.log)).then((data: any)=>{
			if (varaint === 'local') {
				this.toast.showAlert(
					'Log exported',
					'Log file exported to: ' + data.dir + '/' + data.name,
					false
				);
			}else{
				if (this.platform.is('mobile')) {
					this.socialSharing.share(
						'Log exported',
						'Log file exported ',
						data.dir + '/' + 'FhemNative_Log_Export.json'
					);
				} else{
					const mail = 'mailto:?subject=' +
						'Log exported' + '&body=' +
						'Log file exported ' + '. ' + data.dir;
    				window.location.href = mail;
				}
			}
		}).catch((err) => {
			throw new Error(this.translate.instant('GENERAL.SETTINGS.FHEM.EXPORT.MESSAGES.DIRECTORY'));
		});
	}

	// import FhemNative settings
	async importSettings(){
		this.logger.info('Start settings import');
		const data: any = await this.fileManager.readFile();
		this.logger.info('Settings loaded from file. Start procedure');
		let isValid: boolean = false;
		if(data && data.connectionProfiles){
			isValid = true;
			// disconnect from fhem
			this.fhem.noReconnect = true;
			if(this.fhem.connected){
				this.fhem.disconnect();
			}
			// start import
			const len = Object.keys(data).length;
			let i = 0;
			for (const [key, value] of Object.entries(data)){
				const val: any = value;
				if (key !== undefined) {
					this.storage.changeSetting({
						name: key,
						change: JSON.parse(val)	
					}).then(()=>{
						i++;
						if (i === len) {
							// reconnect to fhem with new IP
							this.settings.loadDefaults().then(()=>{
								setTimeout(()=>{
									this.fhem.noReconnect = false;
									this.fhem.connectFhem();
									this.structure.loadRooms(true, false, true);
									// close menu
									this.closeSettings();
									this.toast.showAlert(
										this.translate.instant('GENERAL.SETTINGS.FHEM.IMPORT.MESSAGES.SUCCESS.TITLE'),
										this.translate.instant('GENERAL.SETTINGS.FHEM.IMPORT.MESSAGES.SUCCESS.INFO'),
										false
									);
									this.logger.info('Settings import was successful');
								}, 100);
							});
						}
					});
				}
			}
		}else{
			this.logger.info('Settings not imported (not valid)');
		}
	}

	// custom theme edit
	changeMenuMode(mode: string){
		this.menus[mode] = !this.menus[mode]; 
		// load devices to settings
		if(mode === 'advanced' && this.menus[mode]){
			this.http.get('https://raw.githubusercontent.com/Syrex-o/FhemNative/master/DEVICE_SIZE_LIST.json').subscribe((res:any)=>{
				if(res && res.DEVICES){
					this.devices = res.DEVICES;
				}
			});
		}
	}

	// change color in custom theme
	changeCustomColor(jsonProp: string, value: string){
		this.storage.changeSetting({
			name: 'customTheme',
			change: JSON.stringify(this.settings.app.customTheme)
		});
	}

	// change window size
	changeCustomDeviceSize(selectedDevice: string){
		let found = this.devices.find(x=> x.device === selectedDevice);
		if(found){
			this.settings.app.customWindowScale.deviceSelection = selectedDevice;
			this.settings.app.customWindowScale.dimensions = found.dimensions;
			this.settings.scaleWindow();
			// save settings
			this.storage.changeSetting({
				name: 'customWindowScale',
				change: JSON.stringify(this.settings.app.customWindowScale)
			});
		}
	}

	// full custom device size
	changeCustomDeviceSizeFromInput(){
		let dim = this.settings.app.customWindowScale.dimensions;
		if(dim.width > 0 && dim.height > 0){
			this.settings.app.customWindowScale.deviceSelection = '';
			this.settings.app.customWindowScale.dimensions = dim;
			this.settings.scaleWindow();
			// save settings
			this.storage.changeSetting({
				name: 'customWindowScale',
				change: JSON.stringify(this.settings.app.customWindowScale)
			});
		}else{
			// error
			this.toast.showAlert(
				this.translate.instant('GENERAL.SETTINGS.ADVANCED.WINDOW.CUSTOM.ERROR.TITLE'),
				this.translate.instant('GENERAL.SETTINGS.ADVANCED.WINDOW.CUSTOM.ERROR.INFO'),
				false
			);
		}
	}

	// change app setting
	changeAppSetting(setting: string, value: any){
		this.storage.changeSetting({name: setting, change: value}).then((res) => {this.settings.app[setting] = res; });
	}

	// change JSON app setting
	changeAppSettingJSON(setting: string, jsonProp: string, value: any){
		this.settings.app[setting][jsonProp] = value;
		this.storage.changeSetting({
			name: setting,
			change: JSON.stringify(this.settings.app[setting])
		}).then((res) => {
			this.settings.app[setting] = res;
		});
	}

	// toggle task change
	toggleTasks(event: boolean){
		if(event){
			this.task.listen();
		}else{
			this.task.unlisten();
		}
	}

	// show changelog
	toggleChangelog(){
		this.settings.modes.showLoader = true;
		this.menus.changeLog = !this.menus.changeLog;
		const baseUrl = 'https://raw.githubusercontent.com/Syrex-o/FhemNative/master/CHANGELOG.json';
		this.http.get(baseUrl).subscribe((res: any) => {
			if (res) {
				this.changelog = res;
				// displaying last version first
				const relChangelog = this.changelog.VERSIONS.findIndex(v=> v.VERSION === this.version.appVersion);
				this.changelog.selectedVersion = relChangelog > -1 ? relChangelog : this.changelog.VERSIONS.length - 1;
			} else {
				this.toast.addNotify('Changelog', this.translate.instant('GENERAL.DICTIONARY.NO_CHANGELOG_PRESENT'), false);
			}
			this.settings.modes.showLoader = false;
		}, (error)=>{
			this.settings.modes.showLoader = false;
		});
	}

	// cersion evaluator
	isVersionAvailable(index: number){
		const relChangelog = this.changelog.VERSIONS.findIndex(v=> v.VERSION === this.version.appVersion);
		if(relChangelog > -1){
			if(index <= relChangelog){
				return false;
			}else{
				return true;
			}
		}else{
			return false;
		}
	}

	// toggle URL links
	support(url){
		window.open(url, '_system', 'location=yes');
	}

	// generate rooms
	generateRooms(){
		this.settings.modes.showLoader = true;
		let gotReply: boolean = false;
		const sub = this.fhem.deviceListSub.subscribe(next=>{
			this.settings.modes.showLoader = false;
			gotReply = true;
			sub.unsubscribe();

			const generatedRooms = this.addRooms(
				this.fhem.devices.filter((x)=>{ return Object.getOwnPropertyNames(x.attributes).find((y)=>{ return y === 'room'}) })
			);

			if(generatedRooms.length > 0){
				// save the generated rooms
				this.structure.saveRooms().then(() => {
					this.toast.showAlert(
						(generatedRooms.length > 1 ? this.translate.instant('GENERAL.DICTIONARY.ROOMS') : this.translate.instant('GENERAL.DICTIONARY.ROOM')) + ' ' + this.translate.instant('GENERAL.DICTIONARY.ADDED') + ':',
						(generatedRooms.length > 1 ?
							this.translate.instant('GENERAL.DICTIONARY.ROOMS') + ': ' :
							this.translate.instant('GENERAL.DICTIONARY.ROOM') + ': '
						) + generatedRooms.join(', ') + ' ' + this.translate.instant('GENERAL.DICTIONARY.ADDED') + '.',
						false
					);
				});
			} else{
				// No rooms added
				this.toast.showAlert(
					this.translate.instant('GENERAL.DICTIONARY.NO_ROOMS_ADDED_TITLE'),
					this.translate.instant('GENERAL.DICTIONARY.NO_ROOMS_ADDED_INFO'),
					false
				);
			}
		});
		setTimeout(()=>{
			if(!gotReply){
				this.settings.modes.showLoader = false;
				sub.unsubscribe();
				this.toast.showAlert(
					this.translate.instant('GENERAL.DICTIONARY.NO_ROOMS_ADDED_TITLE'),
					this.translate.instant('GENERAL.DICTIONARY.NO_ROOMS_ADDED_INFO_NOT_FOUND'),
					false
				);
			}
		}, 2000);
		this.fhem.listDevices('room=.*');
	}

	// generate devices
	generateDevices(){
		this.settings.modes.showLoader = true;
		// list of generated devices
		let generatedDevices = [];
		let gotReply: boolean = false;
		const sub: Subscription = this.fhem.deviceListSub.subscribe(next=>{
			this.settings.modes.showLoader = false;
			gotReply = true;
			sub.unsubscribe();
			// generate the rooms
			const generatedRooms: string[] = this.addRooms(
				this.fhem.devices.filter((x)=>{ return Object.getOwnPropertyNames(x.attributes).find((y)=>{ return y === 'room'}) })
			);
			// save the generated rooms
			this.structure.saveRooms().then(() => {
				// generate the devices
				const relevantDevices: FhemDevice[]  = this.fhem.devices.filter((x:any)=> {return Object.getOwnPropertyNames(x.attributes).find((y:any) => {return y.match(/FhemNative_.*/)})});
				relevantDevices.forEach((device: FhemDevice)=>{
					// get the relevant FhemNative readings
					const relevantAttributes: string[] = Object.getOwnPropertyNames(device.attributes).filter(y => y.match(/FhemNative_.*/));
					relevantAttributes.forEach((attribute: string)=>{
						const component: string = attribute.match(/(_.*)$/g)[0].replace('_', '');
						const fhemNativeComponent: DynamicComponent|null = this.componentLoader.fhemComponents.find(x=> x.name.replace(' ', '').toLowerCase() === component.toLowerCase());
						// create component
						if(component && fhemNativeComponent){
							this.componentLoader.getFhemComponentData(component).then((componentData: DynamicComponentDefinition)=>{
								const creatorComponent: DynamicComponentDefinition = componentData;
								// get fhemnative attr
								const attr: string = device.attributes[attribute];
								attr.match(/[\w+:]+(?=;)/g).forEach((singleAttr: string)=>{
									// loop single attr and value combination
									const reading: string = singleAttr.match(/\w+/g)[0];
									const definedValue: any = singleAttr.match(/:.*/g)[0].slice(1);
									// assign the values in component
									for (const key of Object.keys(creatorComponent.attributes)) {
										creatorComponent.attributes[key].forEach((fhemNativeAttr: {attr: string, value: any})=>{
											// underscore to ensure unique values (Exp. reading and setReading should not be equal)
											if(fhemNativeAttr.attr.toLowerCase().indexOf( '_' + reading.toLowerCase()) > -1){
												fhemNativeAttr.value = definedValue;
											}
											// assign device
											if(fhemNativeAttr.attr === 'data_device'){
												fhemNativeAttr.value = device.device;
											}
										});
									}
								});
								// component modified from fhem userAttr
								// get room information
								if(device.attributes.room){
									let rooms = [];
									if(device.attributes.room.indexOf('->') > -1){
										const pseudoRooms = device.attributes.room.split('->');
										// only get first structure
										if(pseudoRooms.length >= 2){
											rooms = [pseudoRooms[1]];
										}
									}else{
										rooms = device.attributes.room.split(',');
									}
									rooms.forEach((room: string)=>{
										const foundRoom: any = this.structure.rooms.find(x=> x.name === room);
										if(foundRoom){
											// room found in structure
											// check if device is already defined
											if(foundRoom.components.filter(device=> JSON.stringify(creatorComponent.attributes) === JSON.stringify(device.attributes)).length > 0){
												// component already defined with same values
												generatedDevices.push({device: device.device, generated: false, reason: 'ALREADY_DEFINED', room: room, as: component});
											}else{
												// new component --> add to room
												this.componentLoader.pushComponentToPlace(foundRoom.components, creatorComponent);
												generatedDevices.push({device: device.device, generated: true, room: room, as: component});
											}
										}else{	
											// component rejected because of strange room values
											generatedDevices.push({device: device.device, generated: false, reason: 'ROOM_NAME', as: component});
										}
									});
								}else{
									// no room for component
									generatedDevices.push({device: device.device, generated: false, reason: 'NO_ROOM', as: component});
								}
								
								if(generatedDevices.length > 0){
									this.devicesAdded(generatedDevices);
								}else{
									// No devices for FhemNative found
									this.toast.showAlert(this.translate.instant('GENERAL.DICTIONARY.NO_COMPONENTS_ADDED_TITLE'),this.translate.instant('GENERAL.DICTIONARY.NO_COMPONENTS_ADDED_INFO'),false);
								}
							});
						}
					});
				});
			});
		});
		setTimeout(()=>{
			if(!gotReply){
				this.settings.modes.showLoader = false;
				sub.unsubscribe();
				this.toast.showAlert(
					this.translate.instant('GENERAL.DICTIONARY.NO_COMPONENTS_ADDED_TITLE'),
					this.translate.instant('GENERAL.DICTIONARY.NO_COMPONENTS_ADDED_INFO'),
					false
				);
			}
		}, 2000);

		// send command
		this.fhem.listDevices('userattr=FhemNative.*');
	}

	// add rooms from devices to FhemNative
	addRooms(devices: FhemDevice[]){
		let generatedRooms = [];
		const settingsRooms = this.structure.rooms.map(x=> x.name);

		let roomAdder = (name, groupTo)=>{
			generatedRooms.push(name);
			this.structure.rooms.push({
				ID: this.structure.rooms.length,
				UID: '_' + Math.random().toString(36).substr(2, 9),
				name: name,
				icon: 'home',
				components: []
			});
			if(groupTo){
				const structureRoom = this.structure.rooms[groupTo];
				// test if room is already a structure
				if(structureRoom['useRoomAsGroup']){
					// room is a structure
					if(structureRoom.groupRooms.length > 0){
						// check if room has sub rooms
						const subFound = structureRoom['groupRooms'].find(x => x.name === name);
						if(subFound){
							// room already found
							this.structure.rooms.splice(this.structure.rooms.length -1, 1);
							generatedRooms.splice(generatedRooms.length -1, 1);
						}else{
							// room not found
							this.structure.rooms[groupTo].groupRooms.push({ID: this.structure.rooms.length -1, name: name});
						}
					}
				}else{
					// room is no structure
					this.structure.rooms[groupTo]['useRoomAsGroup'] = true;
					this.structure.rooms[groupTo]['groupRooms'] = [{ID: this.structure.rooms.length -1, name: name}];
				}
			}
		};

		// room name tester
		let roomTest = (roomName: string)=>{
			if(!roomName.match(/Unsorted|hidden/) && !settingsRooms.includes(roomName) && !generatedRooms.includes(roomName)){
				return roomName;
			}
		}

		devices.forEach((device)=>{
			const roomAttr = device.attributes.room;
			// test for psudo rooms
			if(roomAttr.indexOf('->') > -1){
				let leftOverRooms = [];

				const psudoRoomCombination = roomAttr.match(/\w+->\w+/g);
				if(psudoRoomCombination){
					const pseudoRooms = psudoRoomCombination[0].split('->');
					const mainRoom = pseudoRooms[0];
					const subRoom = pseudoRooms[1];

					// get the rooms, that are left
					leftOverRooms = roomAttr.split(',')
					leftOverRooms.splice(leftOverRooms.indexOf(psudoRoomCombination[0]), 1);
					
					// test if mainRoom exists
					if(roomTest(mainRoom)){
						roomAdder(mainRoom, false);
					}
					// add sub room
					roomAdder(subRoom, this.structure.rooms.find(x=> x.name === mainRoom).ID);
				}
				// add the left over rooms
				if(leftOverRooms.length > 0){
					leftOverRooms.forEach((room: string)=>{
						if(roomTest(room)){
							roomAdder(room, false);
						}
					});
				}
			}else{
				const rooms = roomAttr.split(',');
				rooms.forEach((room)=>{
					if(!room.match(/Unsorted|hidden/) && !settingsRooms.includes(room) && !generatedRooms.includes(room)){
						roomAdder(room, false);
					}
				});
			}
		});
		return generatedRooms;
	}

	private devicesAdded(generatedDevices){
		if(generatedDevices.filter(dev => dev.generated).length > 0){
			this.structure.saveRooms().then(()=>{
				this.structure.loadRooms(true, false, true);
			});
			this.toast.showAlert(
				this.translate.instant('GENERAL.DICTIONARY.COMPONENTS')+' '+this.translate.instant('GENERAL.DICTIONARY.ADDED'),
				generatedDevices.filter(dev => dev.generated).map(
					el=> el.device +' '+
					this.translate.instant('GENERAL.DICTIONARY.AS')+' '+
					el.as +' '+
					this.translate.instant('GENERAL.DICTIONARY.TO')+' '+
					el.room
				).join("<br /> <br />"),
				[{
	    			text: this.translate.instant('GENERAL.BUTTONS.OKAY'),
	    			role: 'cancel',
	    			handler: data => this.rejectedDevices(generatedDevices)
	    		}]
			);
		}else{
			this.rejectedDevices(generatedDevices);
		}
	}

	private rejectedDevices(generatedDevices){
		if(generatedDevices.filter(dev => !dev.generated).length > 0){
			this.toast.showAlert(
		    	this.translate.instant('GENERAL.DICTIONARY.NO_COMPONENTS_ADDED_REASON_TITLE'),
		    	generatedDevices.filter(dev => !dev.generated).map(
		    		el=> el.device +' '+
		    		this.translate.instant('GENERAL.DICTIONARY.AS')+' '+
		    		el.as +' '+
		    		(el.room ? ' '+this.translate.instant('GENERAL.DICTIONARY.TO')+' '+
		    			el.room+': ' : ': ') +
		    		this.translate.instant('GENERAL.DICTIONARY.NO_COMPONENTS_ADDED_REASONS.'+el.reason)
		    	).join("<br /> <br />"),
		    	false
		    );
		}
	}

	// reset settings to factory
	resetSettings(){
		this.toast.showAlert(
			this.translate.instant('GENERAL.RESET.REVERT.TITLE'),
			this.translate.instant('GENERAL.RESET.REVERT.SURE'),
			{
				buttons: [
					{
	    				text: this.translate.instant('GENERAL.DICTIONARY.NO'),
	    				role: 'cancel'
	    			},
	    			{
	                    text: this.translate.instant('GENERAL.DICTIONARY.YES'),
	                    handler: () => {
	                    	// reset the settings
	                    	this.resetAllSettings().then(()=>{
	                    		// reset done
	                    		this.toast.showAlert(
									this.translate.instant('GENERAL.RESET.DONE.TITLE'),
									this.translate.instant('GENERAL.RESET.DONE.INFO'),
									false
								);
	                    	});
	                    }
	                }
				]
			}
		);
	}

	// settings reset
	resetAllSettings(){
		return new Promise((resolve)=>{
			this.settings.appDefaults.forEach((setting: any, index: number)=>{
				this.storage.changeSetting({
					name: setting.name,
					change: setting.default
				}).then(()=>{
					if(index === this.settings.appDefaults.length -1){
						this.settings.loadDefaults().then(()=>{
							resolve();
						});
					}
				});
			});
		});
	}

	closeSettings(){
		this.modalCtrl.dismiss();
		this.backBtn.removeHandle(this.handleID);
	}
}
@NgModule({
	imports: [ComponentsModule, IonicModule, TranslateModule],
  	declarations: [SettingsComponent]
})
class SettingsComponentModule {}