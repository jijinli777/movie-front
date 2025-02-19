import Image from "@/component/Image";
import PlayList from "@/component/PlayList";
import RecommendList from "@/component/RecommendList";
import config from "@/config";
import { createPlusVideoPlayer, PlusOpenTypes, plusPlayURL, plusVideoPlayer } from "@/service/plus";
import {
  appConfig,
  dialog,
  isFullscreen,
  isMobileWidth,
  menuCollapsed,
  message,
  playbackRates,
  setAppConfig,
  setFullscreen,
  setTitle,
} from "@/service/common";
import { ThemeTypes } from "@/service/common";
import { postPlayLog } from "@/service/history";
import { fullVideoList, getInfoList, getRecommendVideoList, getVideoDetail, postReport, recommendVideoList } from "@/service/video";
import { DownloadOutlined, ErrorOutlineOutlined, KeyboardArrowDownOutlined, KeyboardArrowUpOutlined } from "@vicons/material";
import { NButton, NCollapseTransition, NIcon, NInput, NSkeleton, NTooltip } from "naive-ui";
import { computed, defineComponent, onMounted, PropType, ref } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from "vue-router";
import Player, { IPlayerOptions } from "xgplayer";
import HlsJsPlayer from "xgplayer-hls.js";
import protocolDetection from "custom-protocol-detection";
import Favorite from "@/component/Favorite";

export default defineComponent({
  props: {
    videoId: {
      type: Number as PropType<number>,
      default: null,
    },
    playId: {
      type: Number as PropType<number>,
      default: null,
    },
  },
  emits: [],
  setup: (props, ctx) => {
    let videoPlayer: Player;

    const el = ref<HTMLElement | undefined>();
    const router = useRouter();
    const playId = ref(props.playId);
    const videoDetail = computed(() => {
      return fullVideoList.value.find(v => v.id === props.videoId);
    });
    const play = computed(() => {
      if (!videoDetail.value) {
        return null;
      }
      return videoDetail.value.playlist?.find(v => v.id === Number(playId.value));
    });
    const infoList = computed(() => {
      return getInfoList(videoDetail.value);
    });

    const toggleCollapse = ref(false);

    const oldTheme = appConfig.value.themeType;
    const oldCollapsed = menuCollapsed.value;
    const oldFullscreen = isFullscreen.value;

    // const playNextUrls = computed(() => {
    //   if (!videoDetail.value || !play.value?.id) {
    //     return [];
    //   }
    //   const playlist = Array.from(videoDetail.value.playlist);
    //   const index = playlist.findIndex(v => v.id === Number(play.value?.id));
    //   return playlist.slice(index).map(v => v.src);
    // });

    function sendPlayLog() {
      if (videoDetail.value && play.value) {
        // 播放历史
        postPlayLog(videoDetail.value.id, play.value.id);
      }
    }

    function autoNextPlay() {
      // 自动进入下一集
      if (appConfig.value.autoNext && videoDetail.value && play.value?.circuit_id) {
        const playlist = Array.from(videoDetail.value.playlist || []).filter(v => v.circuit_id === Number(play.value?.circuit_id));
        const index = playlist.findIndex(v => v.id === Number(play.value?.id));
        if (index < 0 || index >= playlist.length - 1) {
          return;
        }
        const { id: playId } = playlist[index + 1];
        router.replace({ name: "play", params: { videoId: props.videoId, playId } });
      }
    }

    function createPlayer() {
      if (!videoDetail.value) {
        return null;
      }
      if (!play.value) {
        return;
      }
      if (!el.value) {
        return;
      }
      if (config.isApp) {
        createPlusVideoPlayer({
          src: play.value?.src,
          autoplay: appConfig.value.autoplay,
          poster: videoDetail.value?.cover,
        });
        setTimeout(() => {
          plusVideoPlayer.playbackRate(appConfig.value.playbackRate);
        }, 200);

        // 视频播放完自动下一集
        // plusVideoPlayer?.addEventListener("ended", autoNextPlay, false);

        sendPlayLog();
      } else {
        videoPlayer?.destroy();
        const height = appConfig.value.fitVideoSize === "fixWidth" ? undefined : window.innerHeight - 70;
        setTimeout(() => {
          const options: IPlayerOptions = {
            el: el.value,
            autoplay: appConfig.value.autoplay,
            url: play.value?.src || "",
            width: "100%",
            height,
            fitVideoSize: appConfig.value.fitVideoSize,
            // fluid: true,
            poster: videoDetail.value?.cover,
            playbackRate: playbackRates.value,
            defaultPlaybackRate: appConfig.value.playbackRate,
            pip: appConfig.value.pip,
            miniplayer: appConfig.value.miniplayer,
            enableContextmenu: config.isDev,
            lang: "zh-cn",
            volume: appConfig.value.volume / 100,
            closeVideoClick: isMobileWidth.value,
            // playNext: {
            //   urlList: playNextUrls.value,
            // },
            // download: true
          };
          if (String(options.url).indexOf(".m3u8") !== -1) {
            videoPlayer = new HlsJsPlayer(options);
          } else {
            videoPlayer = new Player(options);
          }

          // 视频加载完成做处理
          videoPlayer.once("complete", sendPlayLog);
          videoPlayer.on("ended", autoNextPlay);
        }, 100);
      }

      setTitle(videoDetail.value.title + " - " + play.value.title);
    }

    function fetchData() {
      if (videoPlayer) {
        return;
      }
      const d = message.loading("获取中...", { duration: 0 });
      getVideoDetail(props.videoId)
        .then(() => {
          createPlayer();
        })
        .finally(() => {
          d.destroy();
        });
      // 推荐
      getRecommendVideoList(props.videoId);
    }

    onBeforeRouteUpdate(to => {
      playId.value = Number(to.params.playId);
      createPlayer();
    });

    onMounted(async () => {
      setAppConfig({
        themeType: ThemeTypes.DARK,
      });
      if (config.isMsi && appConfig.value.fullscreenPlay) {
        await setFullscreen(true);
      }
      menuCollapsed.value = true;
      fetchData();
    });

    onBeforeRouteLeave(async () => {
      videoPlayer?.destroy();
      plusVideoPlayer?.close();
      setAppConfig({
        themeType: oldTheme,
      });
      if (config.isMsi) {
        await setFullscreen(oldFullscreen);
      }
      menuCollapsed.value = oldCollapsed;
    });

    return () => (
      <div class="pad-3">
        <div class="video-player-container mar-b-5-item d-flex justify-center align-items-center">
          <div ref={el} class="video-player" id="player" />
        </div>
        <div class="mar-b-5">
          <div class="d-flex direction-column mar-b-3-item">
            {videoDetail.value && play.value ? (
              <div class="d-flex justify-between align-items-start mar-b-3-item">
                <div class="d-flex align-items-start flex-item-extend justify-start mar-r-4-item">
                  <h1 class="font-xlg mar-r-2-item">{videoDetail.value.title}</h1>
                  <div class="d-flex align-items-center flex-item-extend pad-t-1">
                    <span class="font-large font-bold mar-r-2-item font-gray">·</span>
                    <span class="space-nowrap">{play.value.title}</span>
                  </div>
                </div>
                <div class="d-flex align-items-center">
                  {(config.isWeb || config.isMsi) && play.value.src.includes(".m3u8") ? (
                    <NTooltip>
                      {{
                        default: () => "下载视频",
                        trigger: () => (
                          <NButton
                            size="small"
                            class="mar-r-2-item"
                            onClick={() => {
                              const webUrl = `${config.toolBoxWebUrl}/video/m3u8?url=${play.value?.src}&name=${videoDetail.value?.title}-${play.value?.title}`;
                              const schemeUrl = webUrl.replace(config.toolBoxWebUrl + "/", config.toolBoxSchemeUrl);
                              protocolDetection(schemeUrl, () => {
                                window.open(webUrl, "_blank");
                              });
                            }}
                          >
                            {{
                              icon: () => <DownloadOutlined />,
                            }}
                          </NButton>
                        ),
                      }}
                    </NTooltip>
                  ) : null}
                  <NTooltip>
                    {{
                      default: () => "纠错",
                      trigger: () => (
                        <NButton
                          size="small"
                          class="mar-r-2-item"
                          onClick={() => {
                            let remark = "无法播放";
                            dialog.warning({
                              title: "提交错误",
                              content() {
                                return (
                                  <NInput type="textarea" placeholder="请输入错误内容" defaultValue={remark} onInput={v => (remark = v)} />
                                );
                              },
                              positiveText: "确认提交",
                              onPositiveClick() {
                                if (!videoDetail.value || !remark) {
                                  return;
                                }
                                return postReport(remark, videoDetail.value.id, play.value?.id);
                              },
                            });
                          }}
                        >
                          {{
                            icon: () => <ErrorOutlineOutlined />,
                          }}
                        </NButton>
                      ),
                    }}
                  </NTooltip>
                  <Favorite videoId={videoDetail.value?.id} />
                  <div
                    class="d-flex align-items-center cursor-pointer mar-r-2-item"
                    onClick={() => (toggleCollapse.value = !toggleCollapse.value)}
                  >
                    <span class="font-gray mar-r-1-item font-small">简介</span>
                    <NIcon size={20}>{toggleCollapse.value ? <KeyboardArrowUpOutlined /> : <KeyboardArrowDownOutlined />}</NIcon>
                  </div>
                </div>
              </div>
            ) : (
              <NSkeleton height="30px"></NSkeleton>
            )}
            {config.isApp && play.value?.src ? (
              <div class="d-flex justify-between align-items-center">
                <NButton
                  class="flex-item-extend mar-r-3-item"
                  block
                  type="primary"
                  onClick={() => {
                    plus.nativeUI.actionSheet(
                      {
                        title: "请选择打开方式",
                        cancel: "取消",
                        buttons: [
                          {
                            title: "原生应用打开",
                          },
                          {
                            title: "浏览器打开",
                          },
                        ],
                      },
                      ({ index }: { index: number }) => {
                        if (index <= 0) {
                          return;
                        }
                        let type = PlusOpenTypes.NATIVE;
                        if (index === 2) {
                          type = PlusOpenTypes.BROWSER;
                        }
                        // videoPlayer?.pause();
                        plusVideoPlayer?.stop();
                        plusPlayURL(play.value?.src || "", type);
                      }
                    );
                  }}
                >
                  原生播放器观看
                </NButton>
                <NButton
                  type="primary"
                  ghost
                  icon-placement="right"
                  onClick={() => {
                    const list = playbackRates.value.slice(0, -1);
                    const buttons = list.map(v => ({
                      title: `${v} x`,
                    }));
                    plus.nativeUI.actionSheet(
                      {
                        title: "播放速度选择",
                        cancel: "取消",
                        buttons,
                      },
                      ({ index }: { index: number }) => {
                        if (index <= 0) {
                          return;
                        }
                        const playbackRate = list[index - 1];
                        plusVideoPlayer.playbackRate(playbackRate);
                        setAppConfig({ playbackRate });
                      }
                    );
                  }}
                >
                  {{
                    default() {
                      return appConfig.value.playbackRate + "倍";
                    },
                    icon() {
                      return (
                        <NIcon>
                          <KeyboardArrowDownOutlined />
                        </NIcon>
                      );
                    },
                  }}
                </NButton>
              </div>
            ) : null}
          </div>
          <NCollapseTransition show={toggleCollapse.value}>
            <div class="video-info video-info-small d-flex">
              <div class="video-cover">
                <Image src={videoDetail.value?.cover} />
              </div>
              <div class="flex-item-extend d-flex direction-column break-all">
                {infoList.value.map(info => (
                  <div class="mar-b-4-item d-flex" key={info.value}>
                    <span class="font-gray font-small mar-r-3">{info.text}</span>
                    <span class="flex-item-extend">{info.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </NCollapseTransition>
        </div>
        <PlayList
          playId={play.value?.id}
          playlist={videoDetail.value?.playlist}
          onClick={({ id: playId }) => {
            router.replace({ name: "play", params: { videoId: props.videoId, playId } });
          }}
        />
        <div class="mar-t-4">{recommendVideoList.value.length ? <RecommendList /> : null}</div>
      </div>
    );
  },
});
