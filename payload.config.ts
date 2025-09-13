
import { BaseDatabaseAdapter, buildConfig, Payload} from 'payload'
import Emails from "./src/collections/Emails.js"
import {createEmailTemplatesCollection} from "./src/collections/EmailTemplates.js"
import path from "path"
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default buildConfig({
  collections: [
    Emails,
    createEmailTemplatesCollection()
  ],
  db: {
    allowIDOnCreate: undefined,
    defaultIDType: 'number',
    init: function (args: { payload: Payload; }): BaseDatabaseAdapter {
      throw new Error('Function not implemented.');
    },
    name: undefined
  },
  secret: '',
  typescript: {
    outputFile: path.resolve(__dirname, 'src/payload-types.ts'),
  }
});
