/**
 * 0.2 秒的 8kHz / 16bit / 单声道 WAV fixtures。
 *
 * 用真实音频而不是随便几字节：上传链路里 music-metadata 要能解析出格式与时长，
 * 文件体积又必须足够小，才能在冒烟里几毫秒传完。
 */
export const WAV_SECONDS = 0.2
export const WAV_SAMPLE_RATE = 8000

export function wavFixture(seconds = WAV_SECONDS) {
  const samples = Math.round(WAV_SAMPLE_RATE * seconds)
  const data = Buffer.alloc(samples * 2)
  for (let index = 0; index < samples; index += 1) {
    const value = Math.round(8000 * Math.sin((2 * Math.PI * 440 * index) / WAV_SAMPLE_RATE))
    data.writeInt16LE(value, index * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // 单声道
  header.writeUInt32LE(WAV_SAMPLE_RATE, 24)
  header.writeUInt32LE(WAV_SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}
