# Video downloader
## Description
This is a simple video downloader that can download videos from YouTube and other sites using [yt-dlp](https://github.com/yt-dlp/yt-dlp). It has a simple, user friendly front end to allow for easy use, and includes common options, like start/end times, file type options, and formating.
## Dependencies
This project does not depend on any npm packages. It, however, require you to have [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [FFmpeg](https://ffmpeg.org/) installed on your system. In addition, it's recommended to run this with [pm2](https://github.com/Unitech/pm2) or another Node process manager, as the server will end itself when it needs to restart.
## Running
To run the project, simply run the following command in the project directory:
```shell
npm start
```
The default port is 80. To change the port, set the PORT environment variable to the desired port number.
## License
This project has no license. You can do whatever you want with it. If you copy, modify or distribute it, you don't have to credit me (but I would prefer if you do).