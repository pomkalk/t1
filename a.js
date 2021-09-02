const fs = require('fs')
const path = require('path')
const { spawn, exec } = require('child_process')

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

    static async list (file) {
        return new Promise((resolve, reject) => {
            let a = exec(`7z l "${file}" | iconv -f cp866 -t utf-8`, (err, res) => {
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
        let cmd = `7z e -so "${file}" "${name}"`;
        if (process.platform === 'win32') {
            cmd = `echo "${name}" | iconv -f utf-8 -t cp866 | xargs 7z e -so "${file}"`
        }

        return new Promise((resolve, reject) => {
            exec(`echo "${name}" | iconv -f utf-8 -t cp866`, { encoding: 'buffer' }, (err, res) => {
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
                console.log(data)
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
}

const main = async () => {
    let ar = './597_mnt2.zip'
    let j = './1.json'
    
    console.log (await Archive7z.check7z())

    let l = await Archive7z.list(ar)
    //console.log(l)
    console.log(process.platform)
    let f = l.find(x => x.ext === '.mp3')
    console.log(f)
    let b = await Archive7z.getBuffer(ar, f.path)
    console.log(b.toString())
    // let crc = await Archive7z.crc64(b)
    // console.log(crc)
    // let s = await Archive7z.getAudioLength('./1.mp3')
    // console.log(s)
}
main()