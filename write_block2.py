with open('clean_block.txt', 'w', encoding='utf8') as f:
    f.write("""// Media handler
  if (msg.hasMedia) {
    if (!body) {
      await pushMessage(userId, "user", "[Media file sans texte]");
      try {
        await pool.query(
          `UPDATE "LeadStatus" SET reminder_count = 0, last_reminder_at = NULL WHERE phone = $1`,
          [userId]
        );
      } catch (_) {}
      
      const lastReply = lastMediaReply.get(userId) || 0;
      const now = Date.now();
      if (now - lastReply > 2 * 60 * 1000) {
        lastMediaReply.set(userId, now);
        await msg.reply(
          BOT_WATERMARK + "مرحبا بك، سيقوم أحد أعضاء الفريق التقني بمراجعة الملفات والرد عليك في أقرب وقت.\\n\\nBonjour, notre équipe technique examinera ceci et vous répondra dans les plus brefs délais."
        );
      }
      return;
    } else {
      body = `[SYSTEM: L'utilisateur a envoyé une image/vidéo avec ce texte. Tu ne peux pas voir l'image. Ignore l'image et réponds UNIQUEMENT au texte de l'utilisateur.] ${body}`;
    }
  }
""")
