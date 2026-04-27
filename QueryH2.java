import java.sql.*;
public class QueryH2 {
  public static void main(String[] args) throws Exception {
    String url = "jdbc:h2:file:C:/develop/BI1/backend/data/bi-demo";
    try (Connection c = DriverManager.getConnection(url, "sa", "")) {
      run(c, "select trade_date, net_change, financing_balance from market_financing_balance_pool order by trade_date desc limit 8");
      System.out.println("---");
      run(c, "select board_name, d20260306, d20260313, d20260320, d20260327 from sector_financing_weekly_pool order by d20260327 desc");
      System.out.println("---");
      run(c, "select sum(d20260327) as total_0327, sum(d20260320) as total_0320, sum(d20260313) as total_0313, sum(d20260306) as total_0306 from sector_financing_weekly_pool");
    }
  }
  static void run(Connection c, String sql) throws Exception {
    try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
      ResultSetMetaData md = rs.getMetaData();
      int n = md.getColumnCount();
      while (rs.next()) {
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= n; i++) {
          if (i > 1) sb.append(" | ");
          sb.append(md.getColumnLabel(i)).append("=").append(rs.getString(i));
        }
        System.out.println(sb.toString());
      }
    }
  }
}
