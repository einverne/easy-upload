import { useState } from 'preact/hooks';

import {
  TORRENT_INFO, CURRENT_SITE_NAME,
} from '../const';
import {
  $t, fetch, transferImgs, uploadToPixhost, getValue, uploadToImgbox,
} from '../common';
import Notification from './Notification';

const Transfer = () => {
  const [imgHost, setImgHost] = useState('imgbox');
  const [btnDisable, setBtnDisable] = useState(false);
  const [btnText, setBtnText] = useState('转缩略图');
  const [progress, setProgress] = useState(-1);
  const [imgList, setImgList] = useState([] as string[]);
  const getThumbnailImgs = async () => {
    try {
      const comparisons = TORRENT_INFO.comparisons || [];
      const allImgs: string[] = TORRENT_INFO.screenshots.concat(...comparisons.map(v => v.imgs));
      const imgList: string[] = [...new Set(allImgs)];
      setImgList(imgList);
      if (imgList.length < 1) {
        throw new Error($t('获取图片列表失败'));
      }
      setBtnText('转换中...');
      setBtnDisable(true);
      setProgress(0);
      const hostMap = {
        imgbb: 'https://imgbb.com/json',
        gifyu: 'https://gifyu.com/json',
        pixhost: 'https://pixhost.to',
        imgbox: 'https://imgbox.com',
      };
      const selectHost = hostMap[imgHost as keyof typeof hostMap];
      const uploadedImgs = [];
      let authToken, tokenSecret;
      if (imgHost.match(/imgbb|gifyu/)) {
        const rawHtml = await fetch(selectHost.replace('/json', ''), {
          responseType: undefined,
        });
        authToken = rawHtml.match(/PF\.obj\.config\.auth_token\s*=\s*"(\w+)"/)?.[1];
      } else if (imgHost === 'imgbox') {
        const rawHtml = await fetch('https://imgbox.com', {
          responseType: undefined,
        });
        authToken = rawHtml.match(/content="(.+)" name="csrf-token"/)?.[1];
        tokenSecret = await fetch('https://imgbox.com/ajax/token/generate', {
          responseType: 'json',
          method: 'POST',
          headers: {
            'X-CSRF-Token': authToken,
          },
        });
      }

      for (let index = 0; index < imgList.length; index++) {
        let data;
        if (imgHost.match(/imgbb|gifyu/)) {
          data = await transferImgs(imgList[index], authToken, selectHost);
        } else if (imgHost === 'pixhost') {
          [data] = await uploadToPixhost([imgList[index]]);
        } else if (imgHost === 'imgbox') {
          data = await uploadToImgbox(imgList[index], authToken, tokenSecret);
        }
        if (data) {
          uploadedImgs.push(data);
          setProgress(uploadedImgs.length);
        }
      }
      if (uploadedImgs.length) {
        const thumbnailImgs = uploadedImgs.map(imgData => {
          if (imgHost.match(/imgbb|gifyu/)) {
            return `[url=${imgData.url}][img]${imgData.thumb.url}[/img][/url]`;
          } else if (imgHost === 'imgbox') {
            return `[url=${imgData.original_url}][img]${imgData.thumbnail_url}[/img][/url]`;
          }
          return `[url=${imgData.show_url}][img]${imgData.th_url}[/img][/url]`;
        });
        TORRENT_INFO.screenshots = thumbnailImgs.slice(0, TORRENT_INFO.screenshots.length);
        let { description } = TORRENT_INFO;
        imgList.forEach((img, index) => {
          if (description.includes(img)) {
            const urlReg = new RegExp(`\\[url=${img}\\].+?\\[\\/url\\]\n*`, 'ig');
            if (description.match(urlReg)) {
              description = description.replace(urlReg, thumbnailImgs[index] || '');
            } else {
              description = description.replace(new RegExp(`\\[img\\]${img}\\[\\/img\\]\n*`, 'ig'), thumbnailImgs[index] || '');
            }
          }
        });
        TORRENT_INFO.description = description;
        Notification.open({
          message: $t('成功'),
          description: $t('转换成功！'),
        });
      }
    } catch (error) {
      Notification.open({
        message: $t('错误'),
        description: (error as Error).message,
      });
    } finally {
      setBtnText('转缩略图');
      setBtnDisable(false);
    }
  };
  const transferImgClosed = getValue('easy-seed.transfer-img-closed', false) || '';
  return !(transferImgClosed || CURRENT_SITE_NAME === 'BTN')
    ? <div className="function-list-item">
      <div className="upload-section">
        <button
          className={btnDisable ? 'is-disabled' : ''}
          onClick={getThumbnailImgs}
          disabled={btnDisable}>{$t(btnText)}</button>
        <select
          value={imgHost}
          onChange={(e) => setImgHost((e.target as HTMLSelectElement).value)}>
          <option value="imgbox">imgbox</option>
          <option value="imgbb">imgbb</option>
          <option value="gifyu">gifyu</option>
          <option value="pixhost">pixhost</option>
        </select>
        <div
          id="transfer-progress"
          hidden={progress < 0}>{`${progress} / ${imgList.length}`}</div>
      </div>
    </div>
    : null;
};
export default Transfer;
