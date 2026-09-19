const auth = require('./utils/auth')

App({
  onLaunch() {
    auth.initialize()
  },
})
