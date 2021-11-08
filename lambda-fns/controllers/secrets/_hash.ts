let crypto = require('crypto')

export const _hash = ( value: string) => {
//creating hash object
  let hash = crypto.createHash('sha256')
  //passing the data to be hashed
  const data = hash.update(value, 'utf-8')
  //Creating the hash in the required format
  const gen_hash= data.digest('hex')

  return gen_hash
}