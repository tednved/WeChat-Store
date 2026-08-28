# Store WeChat Pay

This HTTP cloud function is the payment boundary for the Mini Program. It supports JSAPI order creation, order query/close, full refund, and payment/refund callbacks. Business state is stored in the existing `orders` and `products` collections.

## Deploy

Upload this directory to the existing HTTP function `store-wxpay-fzoo4sob-demo-scfweb` with cloud dependency installation enabled. Do not create a second function and do not overwrite the integration-managed payment variables.

Required integration variables:

- `appId`, `merchantId`, `merchantSerialNumber`
- `apiV3Key`, `privateKey`
- `wxPayPublicKey`, `wxPayPublicKeyId`
- `notifyURLPayURL`, `notifyURLRefundsURL`

Optional project variable:

- `ORDER_NOTIFY_TEMPLATE_ID`: merchant subscription-message template ID.

Run `npm test` before packaging. Exclude `node_modules`, `.git`, `.env`, `tests`, and PEM files from the deployment archive.
