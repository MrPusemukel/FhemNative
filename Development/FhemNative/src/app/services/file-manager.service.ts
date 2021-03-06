import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';

// Plugins
import { File } from '@ionic-native/file/ngx';
import { Chooser } from '@ionic-native/chooser/ngx';

// Services
import { ElectronService } from './electron.service';

@Injectable({
	providedIn: 'root'
})

export class FileManagerService {

	constructor(
		private file: File,
		private chooser: Chooser,
		private platform: Platform,
		private electron: ElectronService){}

	// get relevant OS path
	private getDirectory(): string{
		if (this.platform.is('mobile')) {
			return (this.file.externalRootDirectory === null) ? this.file.externalDataDirectory : this.file.externalRootDirectory;
		} else {
			const remote = this.electron.remote;
			return remote.app.getPath('home');
		}
	}

	// open file access menu and select file
	public async readFile(): Promise<any>{
		let data;
		if (this.platform.is('mobile')) {
			await this.chooser.getFile('').then((file) => {
				data = new TextDecoder("utf-8").decode(file.data);
			}).catch((err)=>{
				return null;
			});
		}else{
			const remote = this.electron.remote;
			const dialog: any = remote.dialog;
			
			const files = await dialog.showOpenDialog({properties: ['openFile']});
			if(files){
				const paths = files.filePaths;
				const fs = (window as any).require('fs');
				data = fs.readFileSync(paths[0], 'utf8');
			}else{
				return null;
			}
		}
		if(data && this.IsJsonString(data)){
			return JSON.parse(data);
		}else{
			return null;
		}
	}

	// write local file
	public writeFile(name: string, data: any): Promise<any>{
		return new Promise((resolve, reject)=>{
			const dir = this.getDirectory();
			if (dir) {
				if (this.platform.is('mobile')) {
					this.file.writeFile(dir, name, data, {replace: true}).then((res) => {
						resolve({dir, name});
					}).catch((err) => {
						reject(dir);
					});
				}else{
					const fs = (window as any).require('fs');
					fs.writeFile(dir+'/'+name, data, (err) => {
						if (err) {reject(dir); }
						resolve({dir, name});
					});
				}
			}else{
				reject();
			}
		});
	}

	// test for json
    private IsJsonString(str): boolean {
    	try {
	        JSON.parse(str);
	    } catch (e) {
	        return false;
	    }
	    return true;
    }
}