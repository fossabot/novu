# Notifire Ses Provider

A SES email provider library for [@notifire/core](https://github.com/notifirehq/notifire)

## Usage

```javascript
import { SESEmailProvider } from "@notifire/ses"

const provider = new SESEmailProvider({
    region: "eu-west-1",
    accessKeyId: "AWS_ACCESS_KEY_ID",
    secretAccessKey: "AWS_SECRET_ACCESS_KEY",
    from: "from@email.com",
});
```