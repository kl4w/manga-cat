#!/usr/bin/env node

'use strict';

const mkdirp = require('mkdirp');
const program = require('commander');
const Xray = require('x-ray');
const Download = require('download');
const request = require('request');
const x = new Xray();

program
  .version('0.1.0')
  .option('-l, --list', 'output full manga list information (title, url)', getFullMangaList)
  .option('-r, --releases', 'output latest releases information (title, latest chapter, url)', getLatestReleaseList)
  .option('-d, --download <url>', 'download all available chapters from given url (e.g. http://mangastream.com/manga/toriko)')
  .parse(process.argv);

if (program.download) getChaptersFrom(program.download);

process.on('uncaughtException', (err) => {
  console.log(err);
});

function getFullMangaList() {
  let manga_list_url = 'http://mangastream.com/manga';

  x(manga_list_url, '.main-body .table strong a',
    [{
      title: '',
      url: '@href'
    }]
  )((err, results) => {
    if (err) throw err;
    console.log(results);
  });
}

function getLatestReleaseList() {
  let manga_list_url = 'http://mangastream.com/manga';

  x(manga_list_url, '.main-body .table tr',
    [{
      title: 'strong a',
      latest: 'a.chapter-link',
      url: '.chapter-link@href'
    }]
  )((err, results) => {
    if (err) throw err;
    console.log(results);
  });
}

function getChaptersFrom(url) {
  const getChapters = new Promise((resolve, reject) => {
    x(url, '.main-body', {
      title: 'h1',
      chapters: x('.table a', [{
        name: '',
        url: '@href'
      }])
    })((err, result) => {
      if (err) {
        reject(new Error(err));
      } else {
        resolve(result);
      }
    });
  });

  getChapters.then((results) => {
    console.log('Downloading...');
    downloadChapters(results);
  });
}

function getImageURL(sliced_url, i) {
  return new Promise((resolve, reject) => {
    x(sliced_url + i, 'img#manga-page@src')((err, image) => {
      if (err) reject(new Error(err));
      resolve(image);
    });
  });
}

function downloadImage(sliced_url, chapter_list, chapter, i) {
  return getImageURL(sliced_url, i).then((image) => {
    return new Promise((resolve, reject) => {
      let download = new Download();
      let filename = i + '.png';
      if (i < 10) {
        filename = '0'.concat(i, '.png');
      }

      download.get(image);
      download.rename(filename);
      download.dest('./downloads/' + chapter_list.title + '/Chapter ' + chapter.name);
      console.log(chapter_list.title + ' - Chapter ' + chapter.name + ' - Page ' + i);
      resolve(download.run());
    });
  });
}

function downloadChapters(chapter_list) {
    chapter_list.chapters.forEach((chapter) => {
      let url = chapter.url;
      let length = 0;

      const getLength = new Promise((resolve, reject) => {
        x(url, '.main-body .btn-group:last-child .dropdown-menu li:last-child a')((err, result) => {
          if (err) {
            reject(new Error(err));
          } else {
            let regExp = /\(([^)]+)\)/g;
            let matches = regExp.exec(result);
            length = matches[1];
            resolve(result);
          }
        });
      });

      getLength.then((results) => {
        // remove last digit from url that looks like this: http://readms.com/r/platinum_end/001/3013/1
        let sliced_url = url.slice(0, -1);
        let images_array = [];
        let downloads_array = [];

        for (let i = 1; i <= length; i++) {
          images_array.push(downloadImage(sliced_url, chapter_list, chapter, i));
        }

        return Promise.all(images_array);
      });
    });
}
