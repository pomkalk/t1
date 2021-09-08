const fs = require('fs')
const path = require('path')
const { spawn, exec } = require('child_process')
const iconv = require('iconv-lite')
const unzipper = require('unzipper')

const getCRC = async (file, b) => {
    return new Promise((resolve) => {
        let a = spawn('7z', ['h', '-scrcCRC64', '-si'])
        a.stdin.write(b)
        a.stdin.end()
        let res = ''
        a.stdout.on('data', (data) => {
            res += data.toString()
        })
        a.on('close', () => {
            const match = res.match(/^([A-Z0-9]{16})/m)
            if (match) return resolve(match[0])
            resolve(null)
        })
        //let a = execSync(`7z h -scrcCRC64 ${file}`).toString()
       
    })
    
}

// const main = async () => {
//     let fn = './597_mnt2.zip'
//     let zip = fs.createReadStream(fn).pipe(unzipper.Parse({ forceStream: true,  }) )
//     for await (const entry of zip) {
//         if (entry.type === 'File') {
//             let ext = path.extname(entry.path)
//             let b = await entry.buffer()        
//             fs.writeFileSync(`./w/out${ext}`, b)
//             console.log(iconv.decode(entry.path, 'utf-8'))
//             let c = await getCRC(`./w/out${ext}`, b)

//             console.log(Buffer.from(entry.path, 'utf-8').toString(), c)
//             entry.autodrain()
//         } else {
//             entry.autodrain()
//         }
//     }
// }
// main()

// ^(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2})\s\.*?(\w)\.*?\s+?(\d+?)\s+?(\d+?)\s+?(.+?)$

class Archive7zo {
    static async check7z () {
        return new Promise((resolve, reject) => {
            exec('7z', (err, res) => {
                if (err) {
                    return resolve(false)
                }
                let match = res.match(/7-Zip\s(.+?)\s/m)
                resolve(match ? true : false)
            })
        })
    }

    static async list (file) {
        return new Promise((resolve, reject) => {
            let a = exec(`7z l -sccUTF-8 "${file}" | iconv -f cp866 -t utf-8`, (err, res) => {
                console.log(res)
                if (err) return reject(err)
                let match_all = res.match(/^(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2})\s\.*?([A-Z\.])\.*?\s+?(\d+?)\s+?(\d+?)\s+?(.+?)$/mg)
                if (match_all) {
                    let files = match_all.map(line => {
                        let match = line.match(/^(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2})\s\.*?([A-Z\.])\.*?\s+?(\d+?)\s+?(\d+?)\s+?(.+?)$/m)
                        if (match) {
                            return {
                                date: match[1],
                                time: match[2],
                                is_dir: match[3].indexOf('D') >= 0,
                                size: match[4],
                                name: path.basename(match[6].trim()).slice(0, -path.extname(match[6]).length),
                                path: match[6].trim(),
                                ext: path.extname(match[6]).toLowerCase()
                            }
                        }
                        return null;
                    })
                    resolve(files)
                } else {
                    resolve (null)
                }
            })
        })
    }

    static async list2 (file) {
        return new Promise((resolve, reject) => {
            let a = exec(`7z l -sccDOS "${file}"`, (err, res) => {
                console.log(res)
                if (err) return reject(err)
                let match_all = res.match(/^(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2})\s\.*?([A-Z\.])\.*?\s+?(\d+?)\s+?(\d+?)\s+?(.+?)$/mg)
                if (match_all) {
                    let files = match_all.map(line => {
                        let match = line.match(/^(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2})\s\.*?([A-Z\.])\.*?\s+?(\d+?)\s+?(\d+?)\s+?(.+?)$/m)
                        if (match) {
                            return {
                                date: match[1],
                                time: match[2],
                                is_dir: match[3].indexOf('D') >= 0,
                                size: match[4],
                                name: path.basename(match[6].trim()).slice(0, -path.extname(match[6]).length),
                                path: match[6].trim(),
                                ext: path.extname(match[6]).toLowerCase()
                            }
                        }
                        return null;
                    })
                    resolve(files)
                } else {
                    resolve (null)
                }
            })
        })
    }

    static async getBuffer (file, name) { 
        return new Promise((resolve, reject) => {
            exec(`7z e -sccUTF-8 -so "${file}" "${name}"`, { encoding: 'buffer', maxBuffer: 1024*1024*1024 }, (err, res) => {
                if (err) return reject(err)
                resolve(res)
            })
        })
    }

    static async crc64 (buffer) {
        return new Promise((resolve, reject) => {
            let data = '';
            let proc = spawn('7z', ['h', '-scrcCRC64', '-si'])
            proc.stdin.write(buffer)
            proc.stdin.end()
            proc.stdout.on('data', (chunk) => {
                data += chunk
            })
            proc.on('close', () => {
                const match = data.match(/^([A-Z0-9]{16})\s/m)
                if (match) return resolve(match[0])
                resolve(null)
            })
        })
    }

    static async getAudioLength (file) {
        return new Promise((resolve, reject) => {
            let proc = exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`, (err, res) => {
                if (err) return reject(err)
                resolve(res)
            })
        })
    }

    static async addToArchive (archive, file, name) {
        return new Promise((resolve, reject) => {
            let proc = spawn('7z', ['a', `-si${name}`, archive])
            proc.stdin.write(fs.readFileSync(file))
            proc.stdin.end()
            proc.stderr.on('data', (data) => {
                reject(data.toString())
            })
            proc.on('close', () => {
                resolve()
            })
        })
    }

    static async asd (file, name, la) { 
        return new Promise((resolve, reject) => {
            exec(`echo "${name}" | xargs 7z e -sccWIN -so "${file}"`, { encoding: 'utf-8', maxBuffer: 1024*1024*1024 }, (err, res) => {
                if (err) return reject(err)
                resolve(res)
            })
        })
    }
    static async lll () { 
        return new Promise((resolve, reject) => {
 
            exec(`iconv -l`, {encoding: 'utf-8'},  (err, res) => {
                if (err) return reject(err)
                resolve(res.toString())
            })
        })
    }

}

class Archive7z {

    static async check7z () {
        return new Promise((resolve, reject) => {
            exec('7z', (err, res) => {
                if (err) {
                    return resolve(false)
                }
                let match = res.match(/7-Zip\s(.+?)\s/m)
                resolve(match ? true : false)
            })
        })
    }

    constructor (file_name) {
        this.file_name = path.resolve(file_name)
        this.extract_path = this.file_name.slice(0, -path.extname(this.file_name).length)
        this.is_extracted = false
    }

    async extract () {
        return new Promise((resolve, reject) => {
            exec(`7z x -sccDOS -y -o"${this.extract_path}" "${this.file_name}"`, (err, res) => {
                if (err) return reject(err)
                this.is_extracted = true
                resolve( res )
            })
        })
    }

    _getFiles (dir) {
        let files = fs.readdirSync(dir);
        let list = []
        for (let file of files) {
            let file_name = path.resolve(dir, file)
            if (fs.statSync(file_name).isDirectory()) {
                list.push(...this._getFiles(file_name))
            } else {
                list.push(file_name)
            }
        }
        return list
    }

    getFiles () {
        console.log('sss')
        return this._getFiles(this.extract_path)
    }
}

const main = async () => {
    let ar = './597_mnt2.zip'
    let j = './1.json'
    
    let l = await Archive7zo.list(ar)
   console.log(l)
}
main()