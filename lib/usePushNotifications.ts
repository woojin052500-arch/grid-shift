import { useEffect, useRef } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

const NOTIFICATIONS = [
  "🔥 Grid Shift를 즐기실 시간입니다! 최고 점수에 도전해 보세요!",
  "💡 팁: 무지개 블록을 잘 활용하면 콤보를 쉽게 이어갈 수 있습니다.",
  "🏆 리더보드 1위의 주인공이 되어보세요!",
  "✨ 오늘 당신의 운을 시험해 볼까요? 지금 바로 접속해 보세요.",
  "⚡ 피버 모드가 당신을 기다리고 있습니다!",
  "🌟 새로운 업적을 달성할 시간입니다. 도전해 볼까요?",
  "💎 한 번의 완벽한 스와이프로 10연속 콤보를 노려보세요!",
  "💣 폭탄 블록을 이용해 위기를 기회로 만드세요!",
  "🏅 친구들과 점수를 공유하고 누가 더 잘하는지 겨뤄보세요.",
  "💥 블록들이 터지는 짜릿한 손맛을 다시 느껴보세요!",
  "🔥 잠깐의 휴식 시간, Grid Shift 한 판 어때요?",
  "👑 당신의 실력을 전 세계에 보여줄 시간입니다.",
  "🌠 어제보다 더 높은 점수를 달성해 보세요!",
  "🚀 두뇌 회전에 이만한 게임이 없죠. 지금 바로 고고!",
  "🌈 화려한 이펙트와 함께 스트레스를 날려버리세요.",
  "✨ 매일 조금씩 실력이 느는 걸 느껴보세요.",
  "🔥 엄청난 콤보가 터질 것 같은 예감이 드네요!",
  "💡 게임 오버 직전, 신의 한 수를 찾아내세요.",
  "🏆 새로운 기록이 당신을 기다리고 있습니다.",
  "⚡ 피버 모드에서 한계까지 점수를 뽑아내 보세요!",
  "🌟 아직 해제하지 못한 업적이 있나요? 확인해 보세요.",
  "💎 단 5분의 플레이로도 짜릿함을 느낄 수 있습니다.",
  "💣 막혔을 땐 폭탄이 최고! 지금 접속해서 터뜨려볼까요?",
  "🏅 스토어 리뷰는 개발자에게 엄청난 힘이 됩니다!",
  "💥 연속 라인 클리어의 쾌감을 다시 한번!",
  "🔥 집중력이 필요한 순간, Grid Shift가 딱입니다.",
  "👑 당신도 충분히 10만 점에 도달할 수 있습니다.",
  "🌠 머리를 비우고 블록을 움직이는 데 집중해 보세요.",
  "🚀 지금 접속하면 왠지 대박이 터질 것 같지 않나요?",
  "🌈 당신의 두뇌를 깨워줄 Grid Shift!"
];

export function usePushNotifications() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!Capacitor.isNativePlatform()) {
      return; // Web에서는 로컬 알림을 무시합니다.
    }

    const setupNotifications = async () => {
      try {
        const permStatus = await LocalNotifications.checkPermissions();
        
        if (permStatus.display !== 'granted') {
          const requested = await LocalNotifications.requestPermissions();
          if (requested.display !== 'granted') return;
        }

        // 기존 알림 취소 (중복 예약 방지)
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications });
        }

        // 안드로이드 8.0 이상을 위한 채널 생성
        await LocalNotifications.createChannel({
          id: 'gridshift-marketing',
          name: 'Grid Shift Updates',
          description: 'Game tips and marketing updates',
          importance: 4, // High importance
          visibility: 1, // Public
        });

        // 3시간(10800000ms) 간격으로 30개의 알림 스케줄링
        const notificationsToSchedule = [];
        const now = new Date().getTime();
        const THREE_HOURS = 3 * 60 * 60 * 1000;

        for (let i = 0; i < NOTIFICATIONS.length; i++) {
          // 첫 번째 알림은 5초 뒤에 즉시 발송하여 작동 확인, 그 이후는 3시간 간격
          const delay = i === 0 ? 5000 : THREE_HOURS * i;
          
          notificationsToSchedule.push({
            title: "Grid Shift 🧩",
            body: NOTIFICATIONS[i],
            id: i + 1,
            schedule: { at: new Date(now + delay) },
            smallIcon: "ic_stat_name", // 향후 앱 아이콘 최적화 시 사용
            sound: "default",
            channelId: "gridshift-marketing",
          });
        }

        await LocalNotifications.schedule({
          notifications: notificationsToSchedule
        });
      } catch (e) {
        console.error("Notification setup failed", e);
      }
    };

    setupNotifications();
  }, []);
}
